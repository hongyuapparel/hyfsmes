import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { ExpenseRecord } from '../entities/expense-record.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceExpenseType } from '../entities/finance-expense-type.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class FinanceDashboardService {
  constructor(
    @InjectRepository(IncomeRecord)
    private incomeRepo: Repository<IncomeRecord>,
    @InjectRepository(ExpenseRecord)
    private expenseRepo: Repository<ExpenseRecord>,
    @InjectRepository(FinanceFundAccount)
    private fundAccountRepo: Repository<FinanceFundAccount>,
    @InjectRepository(FinanceIncomeType)
    private incomeTypeRepo: Repository<FinanceIncomeType>,
    @InjectRepository(FinanceExpenseType)
    private expenseTypeRepo: Repository<FinanceExpenseType>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  private formatDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private getDefaultRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      dateFrom: this.formatDate(start),
      dateTo: this.formatDate(end),
    };
  }

  private normalizeDateRange(dateFrom?: string, dateTo?: string) {
    const fallback = this.getDefaultRange();
    const from = (dateFrom || dateTo || fallback.dateFrom).trim();
    const to = (dateTo || dateFrom || fallback.dateTo).trim();
    return from <= to
      ? { dateFrom: from, dateTo: to }
      : { dateFrom: to, dateTo: from };
  }

  private applyOccurDateRange<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    range: { dateFrom: string; dateTo: string },
  ) {
    return qb.where(`${alias}.occur_date >= :dateFrom AND ${alias}.occur_date <= :dateTo`, range);
  }

  async getSummary(params?: { dateFrom?: string; dateTo?: string }) {
    const range = this.normalizeDateRange(params?.dateFrom, params?.dateTo);

    // 区间收入汇总
    const incomeSumRaw = await this.applyOccurDateRange(
      this.incomeRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('SUM(r.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 区间支出汇总
    const expenseSumRaw = await this.applyOccurDateRange(
      this.expenseRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('SUM(r.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 区间订单相关支出（order_no 不为空）
    const orderExpenseRaw = await this.applyOccurDateRange(
      this.expenseRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('SUM(r.amount)', 'total')
      .andWhere("r.order_no != ''")
      .getRawOne<{ total: string | null }>();

    // 区间公司费用（order_no 为空）
    const companyExpenseRaw = await this.applyOccurDateRange(
      this.expenseRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('SUM(r.amount)', 'total')
      .andWhere("(r.order_no IS NULL OR r.order_no = '')")
      .getRawOne<{ total: string | null }>();

    // 区间关联订单的收入
    const orderIncomeRaw = await this.applyOccurDateRange(
      this.incomeRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('SUM(r.amount)', 'total')
      .andWhere("r.order_no != ''")
      .getRawOne<{ total: string | null }>();

    const toNum = (v: string | null | undefined) => parseFloat(v ?? '0') || 0;
    const orderProfit = toNum(orderIncomeRaw?.total) - toNum(orderExpenseRaw?.total);

    // 各账户余额
    const accounts = await this.fundAccountRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const accountBalances = await Promise.all(
      accounts.map(async (a) => {
        const [inR, exR] = await Promise.all([
          this.incomeRepo
            .createQueryBuilder('r')
            .select('SUM(r.amount)', 'total')
            .where('r.fund_account_id = :id', { id: a.id })
            .getRawOne<{ total: string | null }>(),
          this.expenseRepo
            .createQueryBuilder('r')
            .select('SUM(r.amount)', 'total')
            .where('r.fund_account_id = :id', { id: a.id })
            .getRawOne<{ total: string | null }>(),
        ]);
        const balance = toNum(inR?.total) - toNum(exR?.total);
        return { fundAccountId: a.id, fundAccountName: a.name, balance: balance.toFixed(2) };
      }),
    );

    // 区间最近流水
    const recentIncome = await this.applyOccurDateRange(
      this.incomeRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .orderBy('r.occur_date', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .limit(8)
      .getMany();
    const recentExpense = await this.applyOccurDateRange(
      this.expenseRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .orderBy('r.occur_date', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .limit(8)
      .getMany();

    // 区间支出类型TOP5
    const expenseTypeTop5Raw = await this.applyOccurDateRange(
      this.expenseRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('r.expense_type_id', 'expenseTypeId')
      .addSelect('SUM(r.amount)', 'total')
      .andWhere('r.expense_type_id IS NOT NULL')
      .groupBy('r.expense_type_id')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany<{ expenseTypeId: string; total: string }>();

    const expenseTypeIds = expenseTypeTop5Raw.map((r) => Number(r.expenseTypeId));
    const expenseTypes = expenseTypeIds.length
      ? await this.expenseTypeRepo.findByIds(expenseTypeIds)
      : [];
    const etMap = Object.fromEntries(expenseTypes.map((t) => [t.id, t.name]));
    const expenseTypeTop5 = expenseTypeTop5Raw.map((r) => ({
      expenseTypeName: etMap[Number(r.expenseTypeId)] ?? '未知类型',
      totalAmount: parseFloat(r.total).toFixed(2),
    }));

    // 区间部门支出TOP5
    const deptTop5Raw = await this.applyOccurDateRange(
      this.expenseRepo.createQueryBuilder('r'),
      'r',
      range,
    )
      .select('r.department_id', 'departmentId')
      .addSelect('SUM(r.amount)', 'total')
      .andWhere('r.department_id IS NOT NULL')
      .groupBy('r.department_id')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany<{ departmentId: string; total: string }>();

    const deptIds = deptTop5Raw.map((r) => Number(r.departmentId));
    const deptLabels = deptIds.length
      ? await this.systemOptionsService.getOptionLabelsByIds('org_departments', deptIds)
      : ({} as Record<number, string>);
    const deptTop5 = deptTop5Raw.map((r) => ({
      departmentName: deptLabels[Number(r.departmentId)] ?? '未知部门',
      totalAmount: parseFloat(r.total).toFixed(2),
    }));

    // 区间部门利润率
    const [incomeDeptRaw, expenseDeptRaw] = await Promise.all([
      this.applyOccurDateRange(
        this.incomeRepo.createQueryBuilder('r'),
        'r',
        range,
      )
        .select('r.department_id', 'departmentId')
        .addSelect('SUM(r.amount)', 'total')
        .andWhere('r.department_id IS NOT NULL')
        .groupBy('r.department_id')
        .getRawMany<{ departmentId: string; total: string }>(),
      this.applyOccurDateRange(
        this.expenseRepo.createQueryBuilder('r'),
        'r',
        range,
      )
        .select('r.department_id', 'departmentId')
        .addSelect('SUM(r.amount)', 'total')
        .andWhere('r.department_id IS NOT NULL')
        .groupBy('r.department_id')
        .getRawMany<{ departmentId: string; total: string }>(),
    ]);
    const profitabilityDeptIds = [
      ...new Set(
        [...incomeDeptRaw, ...expenseDeptRaw]
          .map((r) => Number(r.departmentId))
          .filter((id) => Number.isFinite(id)),
      ),
    ];
    const profitabilityLabels = profitabilityDeptIds.length
      ? await this.systemOptionsService.getOptionLabelsByIds('org_departments', profitabilityDeptIds)
      : ({} as Record<number, string>);
    const incomeDeptMap = Object.fromEntries(incomeDeptRaw.map((r) => [Number(r.departmentId), toNum(r.total)]));
    const expenseDeptMap = Object.fromEntries(expenseDeptRaw.map((r) => [Number(r.departmentId), toNum(r.total)]));
    const departmentProfitability = profitabilityDeptIds
      .map((departmentId) => {
        const totalIncome = incomeDeptMap[departmentId] ?? 0;
        const totalExpense = expenseDeptMap[departmentId] ?? 0;
        const profit = totalIncome - totalExpense;
        return {
          departmentId,
          departmentName: profitabilityLabels[departmentId] ?? '未知部门',
          totalIncome: totalIncome.toFixed(2),
          totalExpense: totalExpense.toFixed(2),
          profit: profit.toFixed(2),
          profitRate: totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(2) : '',
        };
      })
      .sort((a, b) => Number(b.totalIncome) - Number(a.totalIncome) || Number(b.profit) - Number(a.profit));

    // 解析收入/支出类型名称供最近流水用
    const inTypeIds = [...new Set(recentIncome.map((r) => r.incomeTypeId).filter((v) => v != null) as number[])];
    const inTypes = inTypeIds.length ? await this.incomeTypeRepo.findByIds(inTypeIds) : [];
    const inTypeMap = Object.fromEntries(inTypes.map((t) => [t.id, t.name]));
    const inDeptIds = [...new Set(recentIncome.map((r) => r.departmentId).filter((v) => v != null) as number[])];
    const inDeptLabels = inDeptIds.length
      ? await this.systemOptionsService.getOptionLabelsByIds('org_departments', inDeptIds)
      : ({} as Record<number, string>);

    const exTypeIds = [...new Set(recentExpense.map((r) => r.expenseTypeId).filter((v) => v != null) as number[])];
    const exTypes = exTypeIds.length ? await this.expenseTypeRepo.findByIds(exTypeIds) : [];
    const exTypeMap = Object.fromEntries(exTypes.map((t) => [t.id, t.name]));

    return {
      period: range,
      periodSummary: {
        totalIncome: toNum(incomeSumRaw?.total).toFixed(2),
        totalExpense: toNum(expenseSumRaw?.total).toFixed(2),
        orderExpense: toNum(orderExpenseRaw?.total).toFixed(2),
        companyExpense: toNum(companyExpenseRaw?.total).toFixed(2),
        orderProfit: orderProfit.toFixed(2),
      },
      accountBalances,
      recentIncome: recentIncome.map((r) => ({
        ...r,
        incomeTypeName: r.incomeTypeId != null ? (inTypeMap[r.incomeTypeId] ?? '') : '',
        departmentName: r.departmentId != null ? (inDeptLabels[r.departmentId] ?? '') : '',
      })),
      recentExpense: recentExpense.map((r) => ({
        ...r,
        expenseTypeName: r.expenseTypeId != null ? (exTypeMap[r.expenseTypeId] ?? '') : '',
      })),
      expenseTypeTop5,
      departmentExpenseTop5: deptTop5,
      departmentProfitability,
    };
  }
}
