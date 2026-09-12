import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CASH_KINDS, financeCents, financeDate, financeId, financeMoney, financeText, financeToday } from '../common/finance-value.util';
import { FinanceControlService, FinanceActor } from './finance-control.service';

export type LedgerKind = 'income' | 'expense';
export interface LedgerBody {
  occurDate?: unknown; amount?: unknown; fundAccountId?: unknown; departmentId?: unknown;
  incomeTypeId?: unknown; expenseTypeId?: unknown; sourceName?: unknown; payeeName?: unknown;
  orderNo?: unknown; operator?: unknown; remark?: unknown; attachments?: unknown; objectType?: unknown;
  cashKind?: unknown; bankReference?: unknown; duplicateReason?: unknown; version?: unknown;
}
interface LedgerRow {
  id: number; occur_date: string; amount: string; fund_account_id: number | null; version: number;
  department_id: number | null; cash_kind: string; bank_reference: string; deleted_at: string | null;
  [key: string]: unknown;
}

@Injectable()
export class FinanceLedgerService {
  constructor(private readonly db: DataSource, private readonly control: FinanceControlService) {}
  private table(kind: LedgerKind) { return kind === 'income' ? 'finance_income_records' : 'finance_expense_records'; }

  private async row(manager: EntityManager, kind: LedgerKind, id: number, lock = false) {
    const rows: LedgerRow[] = await manager.query(`SELECT *, DATE_FORMAT(occur_date, '%Y-%m-%d') occur_date FROM ${this.table(kind)} WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!rows.length) throw new NotFoundException('流水不存在');
    return rows[0];
  }

  async save(kind: LedgerKind, id: number | null, dto: LedgerBody, actor: FinanceActor) {
    return this.db.transaction('READ COMMITTED', async manager => {
      const old = id ? await this.row(manager, kind, id) : null;
      const accountId = financeId(dto.fundAccountId === undefined ? old?.fund_account_id : dto.fundAccountId)!;
      const accounts = await this.control.lockAccounts(manager, [accountId, ...(old?.fund_account_id ? [old.fund_account_id] : [])]);
      const current = id ? await this.row(manager, kind, id, true) : null;
      if (current && (current.deleted_at || Number(dto.version) !== current.version)) throw new ConflictException('记录已被修改或删除，请重新打开后再保存');
      if (current?.fund_account_id && current.fund_account_id !== old?.fund_account_id) throw new ConflictException('账户已变更，请重新打开');
      const data: Record<string, unknown> = current ? { ...current } : {};
      const fields = { occurDate: 'occur_date', amount: 'amount', fundAccountId: 'fund_account_id', departmentId: 'department_id',
        cashKind: 'cash_kind', bankReference: 'bank_reference', orderNo: 'order_no', operator: 'operator', remark: 'remark',
        attachments: 'attachments', ...(kind === 'income' ? { incomeTypeId: 'income_type_id', sourceName: 'source_name' } : { expenseTypeId: 'expense_type_id', payeeName: 'payee_name', objectType: 'object_type' }) };
      for (const [key, column] of Object.entries(fields)) if (dto[key as keyof LedgerBody] !== undefined) data[column] = dto[key as keyof LedgerBody];
      data.occur_date = financeDate(data.occur_date);
      if (String(data.occur_date) > financeToday()) throw new BadRequestException('只能登记已发生的收付款');
      const amountCents = financeCents(data.amount, kind === 'income');
      if (amountCents === 0) throw new BadRequestException('收支金额不能为零');
      if (amountCents < 0 && !financeText(data.remark, 500)) throw new BadRequestException('负数支出用于退款或扣款冲减，请在备注填写冲减原因');
      data.amount = financeMoney(amountCents);
      data.fund_account_id = accountId;
      data.department_id = financeId(data.department_id, true);
      data.cash_kind = data.cash_kind ?? 'unclassified';
      if (!CASH_KINDS.includes(data.cash_kind as typeof CASH_KINDS[number])) throw new BadRequestException('收支性质无效；内部转账请使用独立转账入口');
      const typeColumn = kind === 'income' ? 'income_type_id' : 'expense_type_id';
      data[typeColumn] = financeId(data[typeColumn]);
      const types: { id: number }[] = await manager.query(`SELECT id FROM finance_${kind}_types WHERE id=?`, [data[typeColumn]]);
      if (!types.length) throw new BadRequestException('收支类型不存在');
      if (data.department_id) {
        const departments: { id: number }[] = await manager.query("SELECT id FROM system_options WHERE id=? AND option_type='org_departments'", [data.department_id]);
        if (!departments.length) throw new BadRequestException('归属部门不存在，请选择有效部门或留空待归属');
      }
      for (const field of ['bank_reference', 'order_no', 'operator']) data[field] = financeText(data[field], 100);
      data.remark = financeText(data.remark, 500);
      const partyColumn = kind === 'income' ? 'source_name' : 'payee_name';
      data[partyColumn] = financeText(data[partyColumn], 200);
      if (kind === 'expense') data.object_type = financeText(data.object_type, 20);
      let attachments: unknown = data.attachments;
      if (typeof attachments === 'string') { try { attachments = JSON.parse(attachments); } catch { throw new BadRequestException('附件格式错误'); } }
      if (attachments != null && (!Array.isArray(attachments) || attachments.some(item => typeof item !== 'string') || attachments.length > 30)) throw new BadRequestException('附件格式错误或数量过多');
      data.attachments = attachments == null ? null : JSON.stringify(attachments);
      const target = accounts.find(account => account.id === accountId)!;
      this.control.assertOpen(target, String(data.occur_date));
      if (current?.fund_account_id) this.control.assertOpen(accounts.find(a => a.id === current.fund_account_id)!, current.occur_date, true);
      await this.checkDuplicate(manager, kind, id, data, dto.duplicateReason);
      const columns = Object.values(fields);
      let recordId = id;
      if (recordId) {
        await manager.query(`UPDATE ${this.table(kind)} SET ${columns.map(column => `${column}=?`).join(',')}, version=version+1,updated_at=NOW() WHERE id=?`, [...columns.map(column => data[column] ?? null), recordId]);
      } else {
        const result: { insertId: number } = await manager.query(`INSERT INTO ${this.table(kind)} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, columns.map(column => data[column] ?? null));
        recordId = result.insertId;
      }
      await this.control.audit(manager, kind, recordId, id ? 'update' : 'create', actor, current, await this.row(manager, kind, recordId), financeText(dto.duplicateReason, 500));
      return { id: recordId };
    });
  }

  private async checkDuplicate(manager: EntityManager, kind: LedgerKind, id: number | null, data: Record<string, unknown>, reason: unknown) {
    const reference = data.bank_reference;
    const partyColumn = kind === 'income' ? 'source_name' : 'payee_name';
    if (reference) {
      await this.control.assertUniqueReference(manager, Number(data.fund_account_id), String(reference), kind, id ?? 0);
    }
    const suspected: { id: number }[] = await manager.query(`SELECT id FROM ${this.table(kind)} WHERE fund_account_id=? AND amount=? AND occur_date=? AND ${partyColumn}=? AND deleted_at IS NULL AND id<>? LIMIT 5`, [data.fund_account_id, data.amount, data.occur_date, data[partyColumn], id ?? 0]);
    if (suspected.length && !financeText(reason, 500)) throw new ConflictException(`疑似重复记录 ${suspected.map(r => r.id).join('、')}：同日、同账户、同金额、同往来方。确认是另一笔后请填写“重复核实说明”，不要修改往来方绕过检查`);
  }

  async remove(kind: LedgerKind, id: number, version: unknown, reasonValue: unknown, actor: FinanceActor, restore = false) {
    const reason = financeText(reasonValue, 500);
    if (!reason) throw new BadRequestException('请填写删除或恢复原因');
    return this.db.transaction('READ COMMITTED', async manager => {
      const old = await this.row(manager, kind, id);
      const accounts = await this.control.lockAccounts(manager, old.fund_account_id ? [old.fund_account_id] : []);
      const row = await this.row(manager, kind, id, true);
      if (row.version !== Number(version) || row.fund_account_id !== old.fund_account_id) throw new ConflictException('记录已被修改，请刷新后再操作');
      if (restore ? !row.deleted_at : !!row.deleted_at) throw new ConflictException('记录状态已经改变，请刷新');
      if (accounts.length) this.control.assertOpen(accounts[0], row.occur_date, true);
      if (restore) await this.checkDuplicate(manager, kind, id, row, reason);
      await manager.query(`UPDATE ${this.table(kind)} SET deleted_at=${restore ? 'NULL' : 'NOW()'},version=version+1,updated_at=NOW() WHERE id=?`, [id]);
      await this.control.audit(manager, kind, id, restore ? 'restore' : 'delete', actor, row, await this.row(manager, kind, id), reason);
      return { id };
    });
  }
}
