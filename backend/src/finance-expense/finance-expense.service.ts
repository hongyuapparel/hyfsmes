import { financeDate } from '../common/finance-value.util';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    departmentId?: number | null;
    payeeKeyword?: string;
    orderNo?: string;
    cashKind?: string;
    deleted?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { dateFrom, dateTo, expenseTypeId, fundAccountId, departmentId, payeeKeyword, orderNo, page = 1, pageSize = 20 } = params;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new BadRequestException('分页参数无效，每页最多100条');
    if (dateFrom) financeDate(dateFrom);
    if (dateTo) financeDate(dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException('开始日期不能晚于结束日期');
    const qb = this.repo.createQueryBuilder('r');
    if (params.deleted) qb.withDeleted().andWhere('r.deleted_at IS NOT NULL');
    if (params.cashKind) qb.andWhere('r.cash_kind = :cashKind', { cashKind: params.cashKind });
    if (dateFrom) qb.andWhere('r.occur_date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.occur_date <= :dateTo', { dateTo });
    if (expenseTypeId != null) qb.andWhere('r.expense_type_id = :expenseTypeId', { expenseTypeId });
    if (fundAccountId != null) qb.andWhere('r.fund_account_id = :fundAccountId', { fundAccountId });
    if (departmentId === 0) qb.andWhere('r.department_id IS NULL');
    else if (departmentId != null) qb.andWhere('r.department_id = :departmentId', { departmentId });
    if (payeeKeyword) qb.andWhere('r.payee_name LIKE :kw', { kw: `%${payeeKeyword}%` });
    if (orderNo) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo}%` });
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC');
    const total = await qb.getCount();
    const sum = await qb.clone().select('COALESCE(SUM(r.amount), 0)', 'amount').orderBy().getRawOne<{ amount: string }>();
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { list: await this.enrichList(list), total, totalAmount: sum?.amount ?? '0.00', page, pageSize };
  }

  async getOne(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    return (await this.enrichList([r]))[0];
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
      departmentName: r.departmentId != null ? (deptLabels[r.departmentId] ?? ('未知部门 #' + r.departmentId)) : '',
    }));
  }

}
