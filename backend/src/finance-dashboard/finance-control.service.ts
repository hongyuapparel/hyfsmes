import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { financeCents, financeDate, financeId, financeMoney, financeText, financeToday } from '../common/finance-value.util';

export interface FinanceAccountRow {
  id: number; name: string; is_enabled: number; opening_date: string | null; opening_balance: string | null;
  reconciled_through: string | null; reconciled_balance: string | null;
}
export interface FinanceTransferRow {
  id: number; occur_date: string; from_account_id: number; to_account_id: number;
  amount: string; bank_reference: string; remark: string; deleted_at: string | null;
}
export interface FinanceActor { userId: number }

@Injectable()
export class FinanceControlService {
  constructor(private readonly db: DataSource) {}

  async audit(manager: EntityManager, kind: string, id: number, action: string, actor: FinanceActor,
    before: unknown, after: unknown, reason = '') {
    const users: { username: string; display_name: string }[] = await manager.query('SELECT username, display_name FROM users WHERE id = ?', [actor.userId]);
    if (!users.length) throw new BadRequestException('操作人不存在');
    await manager.query('INSERT INTO finance_audit_logs (record_kind,record_id,action,actor_id,actor_name,reason,before_data,after_data) VALUES (?,?,?,?,?,?,?,?)',
      [kind, id, action, actor.userId, users[0].display_name || users[0].username, reason, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]);
  }

  async lockAccounts(manager: EntityManager, ids: number[]) {
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    const rows: FinanceAccountRow[] = [];
    for (const id of unique) {
      const found: FinanceAccountRow[] = await manager.query('SELECT *, DATE_FORMAT(opening_date, "%Y-%m-%d") opening_date, DATE_FORMAT(reconciled_through, "%Y-%m-%d") reconciled_through FROM finance_fund_accounts WHERE id = ? FOR UPDATE', [id]);
      if (!found.length) throw new BadRequestException('资金账户不存在，请重新选择');
      rows.push(found[0]);
    }
    return rows;
  }

  assertOpen(account: FinanceAccountRow, date: string, allowDisabled = false) {
    if (!allowDisabled && !account.is_enabled) throw new BadRequestException('该账户已停用');
    if (account.reconciled_through && date <= account.reconciled_through) throw new ConflictException('该日期已对账锁定，请先在资金核对中撤销对账并填写原因');
    if (account.opening_date && date < account.opening_date) throw new BadRequestException('日期早于该账户期初日期，请核对期初设置');
  }

  // Call only while holding the account lock: all entry paths share one reference namespace.
  async assertUniqueReference(manager: EntityManager, accountId: number, reference: string, excludeKind = '', excludeId = 0) {
    if (!reference) return;
    const rows: { id: number }[] = await manager.query(`
      SELECT id FROM finance_income_records WHERE fund_account_id=? AND bank_reference=? AND deleted_at IS NULL AND NOT (?='income' AND id=?)
      UNION ALL SELECT id FROM finance_expense_records WHERE fund_account_id=? AND bank_reference=? AND deleted_at IS NULL AND NOT (?='expense' AND id=?)
      UNION ALL SELECT id FROM finance_transfers WHERE (from_account_id=? OR to_account_id=?) AND bank_reference=? AND deleted_at IS NULL
      LIMIT 1`, [accountId, reference, excludeKind, excludeId, accountId, reference, excludeKind, excludeId, accountId, accountId, reference]);
    if (rows.length) throw new ConflictException('同账户、同银行流水号已在收入、支出或内部转账中登记，请核对原记录');
  }

  async balance(manager: EntityManager, account: FinanceAccountRow, through: string): Promise<string | null> {
    if (!account.opening_date || account.opening_balance == null || through < account.opening_date) return null;
    const rows: { total: string }[] = await manager.query(`SELECT COALESCE(SUM(delta),0) total FROM (
      SELECT amount delta FROM finance_income_records WHERE fund_account_id=? AND deleted_at IS NULL AND occur_date BETWEEN ? AND ?
      UNION ALL SELECT -amount FROM finance_expense_records WHERE fund_account_id=? AND deleted_at IS NULL AND occur_date BETWEEN ? AND ?
      UNION ALL SELECT amount FROM finance_transfers WHERE to_account_id=? AND deleted_at IS NULL AND occur_date BETWEEN ? AND ?
      UNION ALL SELECT -amount FROM finance_transfers WHERE from_account_id=? AND deleted_at IS NULL AND occur_date BETWEEN ? AND ?
    ) flows`, Array(4).fill([account.id, account.opening_date, through]).flat());
    return financeMoney(financeCents(account.opening_balance) + Math.round(Number(rows[0].total) * 100));
  }

  async accounts(through = financeToday(), existingManager?: EntityManager) {
    const date = financeDate(through);
    const read = async (manager: EntityManager) => {
      const rows: FinanceAccountRow[] = await manager.query('SELECT *, DATE_FORMAT(opening_date, "%Y-%m-%d") opening_date, DATE_FORMAT(reconciled_through, "%Y-%m-%d") reconciled_through FROM finance_fund_accounts ORDER BY sort_order,id');
      return Promise.all(rows.map(async row => ({ ...row, bookBalance: await this.balance(manager, row, date), asOf: date })));
    };
    return existingManager ? read(existingManager) : this.db.transaction('REPEATABLE READ', read);
  }

  async setOpening(id: number, body: { date?: unknown; amount?: unknown; reason?: unknown }, actor: FinanceActor) {
    const date = financeDate(body.date);
    if (date > financeToday()) throw new BadRequestException('期初日期不能晚于今天');
    const amount = financeMoney(financeCents(body.amount));
    const reason = financeText(body.reason, 500);
    if (!reason) throw new BadRequestException('请填写期初余额来源，如银行对账单');
    return this.db.transaction(async manager => {
      const [before] = await this.lockAccounts(manager, [id]);
      if (before.reconciled_through) throw new ConflictException('请先撤销对账后调整期初');
      await manager.query('UPDATE finance_fund_accounts SET opening_date=?, opening_balance=? WHERE id=?', [date, amount, id]);
      await this.audit(manager, 'account', id, 'opening', actor, before, (await this.lockAccounts(manager, [id]))[0], reason);
      return { id };
    });
  }

  async reconcile(id: number, body: { date?: unknown; amount?: unknown }, actor: FinanceActor) {
    const date = financeDate(body.date);
    if (date > financeToday()) throw new BadRequestException('对账日期不能晚于今天');
    const amount = financeMoney(financeCents(body.amount));
    return this.db.transaction(async manager => {
      const [before] = await this.lockAccounts(manager, [id]);
      if (before.reconciled_through && date < before.reconciled_through) throw new BadRequestException('不能退回已核对日期，请先撤销对账');
      const book = await this.balance(manager, before, date);
      if (book === null) throw new BadRequestException('请先设置有效期初余额');
      if (book !== amount) throw new ConflictException(`银行余额与账面不一致：账面 ${book} 元，差额 ${financeMoney(financeCents(amount) - financeCents(book))} 元。请查漏记、重复或账户归属后再核对`);
      await manager.query('UPDATE finance_fund_accounts SET reconciled_through=?, reconciled_balance=? WHERE id=?', [date, amount, id]);
      await this.audit(manager, 'account', id, 'reconcile', actor, before, (await this.lockAccounts(manager, [id]))[0]);
      return { id };
    });
  }

  async reopen(id: number, reasonValue: unknown, actor: FinanceActor) {
    const reason = financeText(reasonValue, 500);
    if (!reason) throw new BadRequestException('请填写撤销对账原因');
    return this.db.transaction(async manager => {
      const [before] = await this.lockAccounts(manager, [id]);
      await manager.query('UPDATE finance_fund_accounts SET reconciled_through=NULL, reconciled_balance=NULL WHERE id=?', [id]);
      await this.audit(manager, 'account', id, 'reopen', actor, before, (await this.lockAccounts(manager, [id]))[0], reason);
      return { id };
    });
  }

  async transfer(body: { date?: unknown; amount?: unknown; fromId?: unknown; toId?: unknown; reference?: unknown; remark?: unknown }, actor: FinanceActor) {
    const date = financeDate(body.date);
    if (date > financeToday()) throw new BadRequestException('只能登记已发生的转账');
    const amount = financeMoney(financeCents(body.amount, true));
    const fromId = financeId(body.fromId)!; const toId = financeId(body.toId)!;
    if (fromId === toId) throw new BadRequestException('转出和转入账户不能相同');
    const reference = financeText(body.reference, 100);
    if (!reference) throw new BadRequestException('请填写银行流水号，防止重复登记转账');
    const remark = financeText(body.remark, 500);
    return this.db.transaction('READ COMMITTED', async manager => {
      const accounts = await this.lockAccounts(manager, [fromId, toId]);
      accounts.forEach(account => this.assertOpen(account, date));
      for (const account of accounts) await this.assertUniqueReference(manager, account.id, reference);
      const result: { insertId: number } = await manager.query('INSERT INTO finance_transfers (occur_date,from_account_id,to_account_id,amount,bank_reference,remark) VALUES (?,?,?,?,?,?)', [date, fromId, toId, amount, reference, remark]);
      await this.audit(manager, 'transfer', result.insertId, 'create', actor, null, { date, fromId, toId, amount, reference, remark });
      return { id: result.insertId };
    });
  }

  async transfers(query: { page?: string; pageSize?: string; status?: string; keyword?: string } = {}) {
    const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? 20);
    const status = query.status || 'active', keyword = financeText(query.keyword, 100);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new BadRequestException('分页参数无效');
    if (!['active', 'void', 'all'].includes(status)) throw new BadRequestException('转账状态无效');
    const where = [status === 'active' ? 't.deleted_at IS NULL' : status === 'void' ? 't.deleted_at IS NOT NULL' : '1=1'];
    const params: string[] = [];
    if (keyword) { where.push('(t.bank_reference LIKE ? OR t.remark LIKE ? OR a.name LIKE ? OR b.name LIKE ?)'); params.push(...Array(4).fill(`%${keyword}%`)); }
    const from = `FROM finance_transfers t LEFT JOIN finance_fund_accounts a ON a.id=t.from_account_id LEFT JOIN finance_fund_accounts b ON b.id=t.to_account_id WHERE ${where.join(' AND ')}`;
    return this.db.transaction('REPEATABLE READ', async manager => {
      const [summary] = await manager.query(`SELECT COUNT(*) total ${from}`, params);
      const list: FinanceTransferRow[] = await manager.query(`SELECT t.*, DATE_FORMAT(t.occur_date, '%Y-%m-%d') occur_date, a.name fromName, b.name toName ${from} ORDER BY t.occur_date DESC,t.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
      return { list, total: Number(summary.total), page, pageSize };
    });
  }

  async cancelTransfer(id: number, reasonValue: unknown, actor: FinanceActor) {
    const reason = financeText(reasonValue, 500);
    if (!reason) throw new BadRequestException('请填写转账作废原因');
    return this.db.transaction(async manager => {
      const rows: FinanceTransferRow[] = await manager.query('SELECT *, DATE_FORMAT(occur_date, "%Y-%m-%d") occur_date FROM finance_transfers WHERE id=?', [id]);
      if (!rows.length) throw new NotFoundException('转账不存在');
      const row = rows[0];
      const accounts = await this.lockAccounts(manager, [row.from_account_id, row.to_account_id]);
      accounts.forEach(account => this.assertOpen(account, row.occur_date, true));
      const result: { affectedRows: number } = await manager.query('UPDATE finance_transfers SET deleted_at=NOW() WHERE id=? AND deleted_at IS NULL', [id]);
      if (!result.affectedRows) throw new ConflictException('转账已作废');
      const [after] = await manager.query("SELECT *, DATE_FORMAT(occur_date, '%Y-%m-%d') occur_date FROM finance_transfers WHERE id=?", [id]);
      await this.audit(manager, 'transfer', id, 'void', actor, row, after, reason);
      return { id };
    });
  }

  async history(kind: string, id: number) {
    if (!['income', 'expense', 'account', 'transfer'].includes(kind)) throw new BadRequestException('记录类型无效');
    return this.db.query('SELECT * FROM finance_audit_logs WHERE record_kind=? AND record_id=? ORDER BY id DESC LIMIT 200', [kind, id]);
  }
}
