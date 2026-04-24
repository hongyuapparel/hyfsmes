import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';

@Injectable()
export class FinanceIncomeService {
  constructor(
    @InjectRepository(IncomeRecord)
    private repo: Repository<IncomeRecord>,
    @InjectRepository(FinanceIncomeType)
    private incomeTypeRepo: Repository<FinanceIncomeType>,
    @InjectRepository(FinanceFundAccount)
    private fundAccountRepo: Repository<FinanceFundAccount>,
  ) {}

  async getList(params: {
    dateFrom?: string;
    dateTo?: string;
    incomeTypeId?: number | null;
    fundAccountId?: number | null;
    sourceNameKeyword?: string;
    orderNo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { dateFrom, dateTo, incomeTypeId, fundAccountId, sourceNameKeyword, orderNo, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('r');
    if (dateFrom) qb.andWhere('r.occur_date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.occur_date <= :dateTo', { dateTo });
    if (incomeTypeId != null) qb.andWhere('r.income_type_id = :incomeTypeId', { incomeTypeId });
    if (fundAccountId != null) qb.andWhere('r.fund_account_id = :fundAccountId', { fundAccountId });
    if (sourceNameKeyword) qb.andWhere('r.source_name LIKE :kw', { kw: `%${sourceNameKeyword}%` });
    if (orderNo) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo}%` });
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { list: await this.enrichList(list), total, page, pageSize };
  }

  async getOne(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('收入记录不存在');
    return (await this.enrichList([r]))[0];
  }

  async create(dto: {
    occurDate: string;
    amount: number | string;
    incomeTypeId?: number | null;
    fundAccountId?: number | null;
    sourceName?: string;
    orderNo?: string;
    operator?: string;
    remark?: string;
    attachments?: string[] | null;
  }) {
    const entity = this.repo.create({
      occurDate: new Date(dto.occurDate),
      amount: String(dto.amount),
      incomeTypeId: dto.incomeTypeId != null ? Number(dto.incomeTypeId) : null,
      fundAccountId: dto.fundAccountId != null ? Number(dto.fundAccountId) : null,
      sourceName: dto.sourceName?.trim() ?? '',
      orderNo: dto.orderNo?.trim() ?? '',
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
    incomeTypeId?: number | null;
    fundAccountId?: number | null;
    sourceName?: string;
    orderNo?: string;
    operator?: string;
    remark?: string;
    attachments?: string[] | null;
  }) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('收入记录不存在');
    if (dto.occurDate != null) r.occurDate = new Date(dto.occurDate);
    if (dto.amount != null) r.amount = String(dto.amount);
    if (dto.incomeTypeId !== undefined) r.incomeTypeId = dto.incomeTypeId != null ? Number(dto.incomeTypeId) : null;
    if (dto.fundAccountId !== undefined) r.fundAccountId = dto.fundAccountId != null ? Number(dto.fundAccountId) : null;
    if (dto.sourceName !== undefined) r.sourceName = dto.sourceName?.trim() ?? '';
    if (dto.orderNo !== undefined) r.orderNo = dto.orderNo?.trim() ?? '';
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
    if (!r) throw new NotFoundException('收入记录不存在');
    await this.repo.remove(r);
  }

  private async enrichList(list: IncomeRecord[]) {
    const typeIds = [...new Set(list.map((r) => r.incomeTypeId).filter((v) => v != null) as number[])];
    const accountIds = [...new Set(list.map((r) => r.fundAccountId).filter((v) => v != null) as number[])];
    const [types, accounts] = await Promise.all([
      typeIds.length ? this.incomeTypeRepo.findByIds(typeIds) : Promise.resolve([]),
      accountIds.length ? this.fundAccountRepo.findByIds(accountIds) : Promise.resolve([]),
    ]);
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    return list.map((r) => ({
      ...r,
      incomeTypeName: r.incomeTypeId != null ? (typeMap[r.incomeTypeId] ?? '') : '',
      fundAccountName: r.fundAccountId != null ? (accountMap[r.fundAccountId] ?? '') : '',
    }));
  }

  /** 疑似重复收入拦截：同金额+同订单号+30天内 */
  private async assertNotDuplicate(entity: IncomeRecord, ignoreId?: number) {
    const amount = String(entity.amount ?? '').trim();
    const orderNo = (entity.orderNo ?? '').trim();
    if (!amount || !orderNo) return;
    const occur = entity.occurDate instanceof Date ? entity.occurDate : new Date(entity.occurDate);
    const from = new Date(occur); from.setDate(from.getDate() - 30);
    const to = new Date(occur); to.setDate(to.getDate() + 30);
    const qb = this.repo.createQueryBuilder('r')
      .where('r.amount = :amount', { amount })
      .andWhere("r.order_no = :orderNo AND r.order_no != ''", { orderNo })
      .andWhere('r.occur_date >= :from AND r.occur_date <= :to', {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
    if (ignoreId) qb.andWhere('r.id <> :ignoreId', { ignoreId });
    const dup = await qb.getOne();
    if (!dup) return;
    throw new ConflictException(
      `疑似重复收入：同金额（${amount}）且同订单号（${orderNo}）在近30天已存在记录（ID=${dup.id}，日期=${new Date(dup.occurDate).toISOString().slice(0, 10)}）。如确需录入，请修改订单号或备注以区分。`,
    );
  }
}
