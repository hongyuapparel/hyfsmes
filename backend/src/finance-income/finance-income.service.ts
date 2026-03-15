import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class FinanceIncomeService {
  constructor(
    @InjectRepository(IncomeRecord)
    private readonly repo: Repository<IncomeRecord>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async getList(params: {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: number | null;
    bankAccountId?: number | null;
    page?: number;
    pageSize?: number;
  }) {
    const {
      dateFrom,
      dateTo,
      departmentId,
      bankAccountId,
      page = 1,
      pageSize = 20,
    } = params;
    const qb = this.repo.createQueryBuilder('r');
    if (dateFrom) {
      qb.andWhere('r.occur_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('r.occur_date <= :dateTo', { dateTo });
    }
    if (departmentId != null) {
      qb.andWhere('r.department_id = :departmentId', { departmentId });
    }
    if (bankAccountId != null) {
      qb.andWhere('r.bank_account_id = :bankAccountId', { bankAccountId });
    }
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const departmentIds = [
      ...new Set(list.map((r) => r.departmentId).filter((id) => id != null) as number[]),
    ];
    const bankAccountIds = [
      ...new Set(list.map((r) => r.bankAccountId).filter((id) => id != null) as number[]),
    ];
    const [departmentLabels, bankAccountLabels] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('org_departments', departmentIds),
      this.systemOptionsService.getOptionLabelsByIds('bank_accounts', bankAccountIds),
    ]);

    const items = list.map((r) => ({
      ...r,
      departmentName: r.departmentId != null ? departmentLabels[r.departmentId] : '',
      bankAccountName: r.bankAccountId != null ? bankAccountLabels[r.bankAccountId] : '',
    }));
    return { list: items, total, page, pageSize };
  }

  async getOne(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('收入记录不存在');
    const [departmentLabels, bankAccountLabels] = await Promise.all([
      r.departmentId != null
        ? this.systemOptionsService.getOptionLabelsByIds('org_departments', [r.departmentId])
        : Promise.resolve({} as Record<number, string>),
      r.bankAccountId != null
        ? this.systemOptionsService.getOptionLabelsByIds('bank_accounts', [r.bankAccountId])
        : Promise.resolve({} as Record<number, string>),
    ]);
    return {
      ...r,
      departmentName: r.departmentId != null ? departmentLabels[r.departmentId] : '',
      bankAccountName: r.bankAccountId != null ? bankAccountLabels[r.bankAccountId] : '',
    };
  }

  async create(dto: {
    occurDate: string;
    amount: number | string;
    departmentId?: number | null;
    bankAccountId?: number | null;
    remark?: string;
  }) {
    const entity = this.repo.create({
      occurDate: new Date(dto.occurDate),
      amount: String(dto.amount),
      departmentId: dto.departmentId != null ? Number(dto.departmentId) : null,
      bankAccountId: dto.bankAccountId != null ? Number(dto.bankAccountId) : null,
      remark: dto.remark?.trim() ?? '',
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: {
      occurDate?: string;
      amount?: number | string;
      departmentId?: number | null;
      bankAccountId?: number | null;
      remark?: string;
    },
  ) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('收入记录不存在');
    if (dto.occurDate != null) r.occurDate = new Date(dto.occurDate);
    if (dto.amount != null) r.amount = String(dto.amount);
    if (dto.departmentId !== undefined) r.departmentId = dto.departmentId != null ? Number(dto.departmentId) : null;
    if (dto.bankAccountId !== undefined) r.bankAccountId = dto.bankAccountId != null ? Number(dto.bankAccountId) : null;
    if (dto.remark !== undefined) r.remark = dto.remark?.trim() ?? '';
    return this.repo.save(r);
  }

  async remove(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('收入记录不存在');
    await this.repo.remove(r);
  }

  /** 下拉选项：部门、银行账号（供收入流水页使用） */
  async getOptions() {
    const [departments, bankAccounts] = await Promise.all([
      this.systemOptionsService.findAllByType('org_departments'),
      this.systemOptionsService.findAllByType('bank_accounts'),
    ]);
    return {
      departments: departments.map((o) => ({ id: o.id, value: o.value })),
      bankAccounts: bankAccounts.map((o) => ({ id: o.id, value: o.value })),
    };
  }
}
