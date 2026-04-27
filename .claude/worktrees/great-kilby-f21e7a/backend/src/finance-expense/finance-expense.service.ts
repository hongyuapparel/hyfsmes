import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseRecord } from '../entities/expense-record.entity';
import { FinanceExpenseType } from '../entities/finance-expense-type.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class FinanceExpenseService {
  constructor(
    @InjectRepository(ExpenseRecord)
    private repo: Repository<ExpenseRecord>,
    @InjectRepository(FinanceExpenseType)
    private expenseTypeRepo: Repository<FinanceExpenseType>,
    @InjectRepository(FinanceFundAccount)
    private fundAccountRepo: Repository<FinanceFundAccount>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async getList(params: {
    dateFrom?: string;
    dateTo?: string;
    expenseTypeId?: number | null;
    fundAccountId?: number | null;
    payeeKeyword?: string;
    orderNo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { dateFrom, dateTo, expenseTypeId, fundAccountId, payeeKeyword, orderNo, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('r');
    if (dateFrom) qb.andWhere('r.occur_date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.occur_date <= :dateTo', { dateTo });
    if (expenseTypeId != null) qb.andWhere('r.expense_type_id = :expenseTypeId', { expenseTypeId });
    if (fundAccountId != null) qb.andWhere('r.fund_account_id = :fundAccountId', { fundAccountId });
    if (payeeKeyword) qb.andWhere('r.payee_name LIKE :kw', { kw: `%${payeeKeyword}%` });
    if (orderNo) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo}%` });
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { list: await this.enrichList(list), total, page, pageSize };
  }

  async getOne(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    return (await this.enrichList([r]))[0];
  }

  async create(dto: {
    occurDate: string;
    amount: number | string;
    expenseTypeId?: number | null;
    fundAccountId?: number | null;
    objectType?: string;
    payeeName?: string;
    orderNo?: string;
    departmentId?: number | null;
    operator?: string;
    remark?: string;
    attachments?: string[] | null;
  }) {
    const entity = this.repo.create({
      occurDate: new Date(dto.occurDate),
      amount: String(dto.amount),
      expenseTypeId: dto.expenseTypeId != null ? Number(dto.expenseTypeId) : null,
      fundAccountId: dto.fundAccountId != null ? Number(dto.fundAccountId) : null,
      objectType: dto.objectType?.trim() ?? '',
      payeeName: dto.payeeName?.trim() ?? '',
      orderNo: dto.orderNo?.trim() ?? '',
      departmentId: dto.departmentId != null ? Number(dto.departmentId) : null,
      operator: dto.operator?.trim() ?? '',
      remark: dto.remark?.trim() ?? '',
      attachments: Array.isArray(dto.attachments) ? dto.attachments.map((u) => String(u).trim()).filter(Boolean) : null,
    });
    await this.assertNotDuplicate(entity);
    return this.repo.save(entity);
  }

  async update(id: number, dto: {
    occurDate?: string;
    amount?: number | string;
    expenseTypeId?: number | null;
    fundAccountId?: number | null;
    objectType?: string;
    payeeName?: string;
    orderNo?: string;
    departmentId?: number | null;
    operator?: string;
    remark?: string;
    attachments?: string[] | null;
  }) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    if (dto.occurDate != null) r.occurDate = new Date(dto.occurDate);
    if (dto.amount != null) r.amount = String(dto.amount);
    if (dto.expenseTypeId !== undefined) r.expenseTypeId = dto.expenseTypeId != null ? Number(dto.expenseTypeId) : null;
    if (dto.fundAccountId !== undefined) r.fundAccountId = dto.fundAccountId != null ? Number(dto.fundAccountId) : null;
    if (dto.objectType !== undefined) r.objectType = dto.objectType?.trim() ?? '';
    if (dto.payeeName !== undefined) r.payeeName = dto.payeeName?.trim() ?? '';
    if (dto.orderNo !== undefined) r.orderNo = dto.orderNo?.trim() ?? '';
    if (dto.departmentId !== undefined) r.departmentId = dto.departmentId != null ? Number(dto.departmentId) : null;
    if (dto.operator !== undefined) r.operator = dto.operator?.trim() ?? '';
    if (dto.remark !== undefined) r.remark = dto.remark?.trim() ?? '';
    if (dto.attachments !== undefined) {
      r.attachments = Array.isArray(dto.attachments) ? dto.attachments.map((u) => String(u).trim()).filter(Boolean) : null;
    }
    await this.assertNotDuplicate(r, id);
    return this.repo.save(r);
  }

  async remove(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    await this.repo.remove(r);
  }

  private async enrichList(list: ExpenseRecord[]) {
    const typeIds = [...new Set(list.map((r) => r.expenseTypeId).filter((v) => v != null) as number[])];
    const accountIds = [...new Set(list.map((r) => r.fundAccountId).filter((v) => v != null) as number[])];
    const deptIds = [...new Set(list.map((r) => r.departmentId).filter((v) => v != null) as number[])];
    const [types, accounts, deptLabels] = await Promise.all([
      typeIds.length ? this.expenseTypeRepo.findByIds(typeIds) : Promise.resolve([]),
      accountIds.length ? this.fundAccountRepo.findByIds(accountIds) : Promise.resolve([]),
      deptIds.length
        ? this.systemOptionsService.getOptionLabelsByIds('org_departments', deptIds)
        : Promise.resolve({} as Record<number, string>),
    ]);
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    return list.map((r) => ({
      ...r,
      expenseTypeName: r.expenseTypeId != null ? (typeMap[r.expenseTypeId] ?? '') : '',
      fundAccountName: r.fundAccountId != null ? (accountMap[r.fundAccountId] ?? '') : '',
      departmentName: r.departmentId != null ? (deptLabels[r.departmentId] ?? '') : '',
    }));
  }

  /** 疑似重复支出拦截：同金额+同收款方+同订单号（有订单号时）+30天内 */
  private async assertNotDuplicate(entity: ExpenseRecord, ignoreId?: number) {
    const amount = String(entity.amount ?? '').trim();
    const payeeName = (entity.payeeName ?? '').trim();
    const orderNo = (entity.orderNo ?? '').trim();
    if (!amount || (!payeeName && !orderNo)) return;
    const occur = entity.occurDate instanceof Date ? entity.occurDate : new Date(entity.occurDate as any);
    const from = new Date(occur); from.setDate(from.getDate() - 30);
    const to = new Date(occur); to.setDate(to.getDate() + 30);
    const qb = this.repo.createQueryBuilder('r')
      .where('r.amount = :amount', { amount })
      .andWhere('r.occur_date >= :from AND r.occur_date <= :to', {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
    if (payeeName) qb.andWhere("r.payee_name = :payeeName AND r.payee_name != ''", { payeeName });
    if (orderNo) qb.andWhere("r.order_no = :orderNo AND r.order_no != ''", { orderNo });
    if (ignoreId) qb.andWhere('r.id <> :ignoreId', { ignoreId });
    const dup = await qb.getOne();
    if (!dup) return;
    throw new ConflictException(
      `疑似重复付款：同金额（${amount}）且收款方/订单号相同，近30天已存在记录（ID=${dup.id}，日期=${new Date(dup.occurDate).toISOString().slice(0, 10)}）。如确需录入，请修改备注或收款方以区分。`,
    );
  }
}
