import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceExpenseType } from '../entities/finance-expense-type.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class FinanceSettingsService {
  constructor(
    @InjectRepository(FinanceFundAccount)
    private fundAccountRepo: Repository<FinanceFundAccount>,
    @InjectRepository(FinanceIncomeType)
    private incomeTypeRepo: Repository<FinanceIncomeType>,
    @InjectRepository(FinanceExpenseType)
    private expenseTypeRepo: Repository<FinanceExpenseType>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  // ─── 资金账户 ───────────────────────────────────────────
  getAllFundAccounts() {
    return this.fundAccountRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }
  getEnabledFundAccounts() {
    return this.fundAccountRepo.find({ where: { isEnabled: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }
  async createFundAccount(dto: Partial<FinanceFundAccount>) {
    const e = this.fundAccountRepo.create(dto);
    return this.fundAccountRepo.save(e);
  }
  async updateFundAccount(id: number, dto: Partial<FinanceFundAccount>) {
    const e = await this.fundAccountRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('资金账户不存在');
    Object.assign(e, dto);
    return this.fundAccountRepo.save(e);
  }
  async removeFundAccount(id: number) {
    const e = await this.fundAccountRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('资金账户不存在');
    await this.fundAccountRepo.remove(e);
  }

  // ─── 收入类型 ───────────────────────────────────────────
  getAllIncomeTypes() {
    return this.incomeTypeRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }
  getEnabledIncomeTypes() {
    return this.incomeTypeRepo.find({ where: { isEnabled: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }
  async createIncomeType(dto: Partial<FinanceIncomeType>) {
    const e = this.incomeTypeRepo.create(dto);
    return this.incomeTypeRepo.save(e);
  }
  async updateIncomeType(id: number, dto: Partial<FinanceIncomeType>) {
    const e = await this.incomeTypeRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('收入类型不存在');
    Object.assign(e, dto);
    return this.incomeTypeRepo.save(e);
  }
  async removeIncomeType(id: number) {
    const e = await this.incomeTypeRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('收入类型不存在');
    await this.incomeTypeRepo.remove(e);
  }

  // ─── 支出类型 ───────────────────────────────────────────
  getAllExpenseTypes() {
    return this.expenseTypeRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }
  getEnabledExpenseTypes() {
    return this.expenseTypeRepo.find({ where: { isEnabled: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }
  async createExpenseType(dto: Partial<FinanceExpenseType>) {
    const e = this.expenseTypeRepo.create(dto);
    return this.expenseTypeRepo.save(e);
  }
  async updateExpenseType(id: number, dto: Partial<FinanceExpenseType>) {
    const e = await this.expenseTypeRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('支出类型不存在');
    Object.assign(e, dto);
    return this.expenseTypeRepo.save(e);
  }
  async removeExpenseType(id: number) {
    const e = await this.expenseTypeRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('支出类型不存在');
    await this.expenseTypeRepo.remove(e);
  }

  /** 一次性获取所有启用的下拉选项（供流水页面用） */
  async getDropdownOptions() {
    const [fundAccounts, incomeTypes, expenseTypes, departments] = await Promise.all([
      this.getEnabledFundAccounts(),
      this.getEnabledIncomeTypes(),
      this.getEnabledExpenseTypes(),
      this.systemOptionsService.findAllByType('org_departments'),
    ]);
    return {
      fundAccounts,
      incomeTypes,
      expenseTypes,
      departments: departments.filter((item) => item.parentId == null),
    };
  }
}
