import { financeDate } from '../common/finance-value.util';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class FinanceIncomeService {
  constructor(
    @InjectRepository(IncomeRecord)
    private repo: Repository<IncomeRecord>,
    @InjectRepository(FinanceIncomeType)
    private incomeTypeRepo: Repository<FinanceIncomeType>,
    @InjectRepository(FinanceFundAccount)
    private fundAccountRepo: Repository<FinanceFundAccount>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async getList(params: {
    dateFrom?: string;
    dateTo?: string;
    incomeTypeId?: number | null;
    fundAccountId?: number | null;
    departmentId?: number | null;
    sourceNameKeyword?: string;
    orderNo?: string;
    cashKind?: string;
    deleted?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const {
      dateFrom,
      dateTo,
      incomeTypeId,
      fundAccountId,
      departmentId,
      sourceNameKeyword,
      orderNo,
      page = 1,
      pageSize = 20,
    } = params;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new BadRequestException('分页参数无效，每页最多100条');
    if (dateFrom) financeDate(dateFrom);
    if (dateTo) financeDate(dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException('开始日期不能晚于结束日期');
    const qb = this.repo.createQueryBuilder('r');
    if (params.deleted) qb.withDeleted().andWhere('r.deleted_at IS NOT NULL');
    if (params.cashKind) qb.andWhere('r.cash_kind = :cashKind', { cashKind: params.cashKind });
    if (dateFrom) qb.andWhere('r.occur_date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.occur_date <= :dateTo', { dateTo });
    if (incomeTypeId != null) qb.andWhere('r.income_type_id = :incomeTypeId', { incomeTypeId });
    if (fundAccountId != null) qb.andWhere('r.fund_account_id = :fundAccountId', { fundAccountId });
    if (departmentId === 0) qb.andWhere('r.department_id IS NULL');
    else if (departmentId != null) qb.andWhere('r.department_id = :departmentId', { departmentId });
    if (sourceNameKeyword) qb.andWhere('r.source_name LIKE :kw', { kw: `%${sourceNameKeyword}%` });
    if (orderNo) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo}%` });
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC');
    const total = await qb.getCount();
    const sum = await qb.clone().select('COALESCE(SUM(r.amount), 0)', 'amount').orderBy().getRawOne<{ amount: string }>();
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { list: await this.enrichList(list), total, totalAmount: sum?.amount ?? '0.00', page, pageSize };
  }

  async getOne(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('收入记录不存在');
    return (await this.enrichList([r]))[0];
  }

  private async enrichList(list: IncomeRecord[]) {
    const typeIds = [...new Set(list.map((r) => r.incomeTypeId).filter((v) => v != null) as number[])];
    const accountIds = [...new Set(list.map((r) => r.fundAccountId).filter((v) => v != null) as number[])];
    const deptIds = [...new Set(list.map((r) => r.departmentId).filter((v) => v != null) as number[])];
    const [types, accounts, deptLabels] = await Promise.all([
      typeIds.length ? this.incomeTypeRepo.findByIds(typeIds) : Promise.resolve([]),
      accountIds.length ? this.fundAccountRepo.findByIds(accountIds) : Promise.resolve([]),
      deptIds.length
        ? this.systemOptionsService.getOptionLabelsByIds('org_departments', deptIds)
        : Promise.resolve({} as Record<number, string>),
    ]);
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    return list.map((r) => ({
      ...r,
      incomeTypeName: r.incomeTypeId != null ? (typeMap[r.incomeTypeId] ?? '') : '',
      fundAccountName: r.fundAccountId != null ? (accountMap[r.fundAccountId] ?? '') : '',
      departmentName: r.departmentId != null ? (deptLabels[r.departmentId] ?? ('未知部门 #' + r.departmentId)) : '',
    }));
  }

}
