import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async getSummary() {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    // 本月收入汇总
    const incomeSumRaw = await this.incomeRepo
      .createQueryBuilder('r')
      .select('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
      .getRawOne<{ total: string | null }>();

    // 本月支出汇总
    const expenseSumRaw = await this.expenseRepo
      .createQueryBuilder('r')
      .select('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
      .getRawOne<{ total: string | null }>();

    // 本月订单相关支出（order_no 不为空）
    const orderExpenseRaw = await this.expenseRepo
      .createQueryBuilder('r')
      .select('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
      .andWhere("r.order_no != ''")
      .getRawOne<{ total: string | null }>();

    // 本月公司费用（order_no 为空）
    const companyExpenseRaw = await this.expenseRepo
      .createQueryBuilder('r')
      .select('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
      .andWhere("(r.order_no IS NULL OR r.order_no = '')")
      .getRawOne<{ total: string | null }>();

    // 本月关联订单的收入
    const orderIncomeRaw = await this.incomeRepo
      .createQueryBuilder('r')
      .select('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
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

    // 最近流水
    const recentIncome = await this.incomeRepo.find({
      order: { occurDate: 'DESC', id: 'DESC' },
      take: 8,
    });
    const recentExpense = await this.expenseRepo.find({
      order: { occurDate: 'DESC', id: 'DESC' },
      take: 8,
    });

    // 本月支出类型TOP5
    const expenseTypeTop5Raw = await this.expenseRepo
      .createQueryBuilder('r')
      .select('r.expense_type_id', 'expenseTypeId')
      .addSelect('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
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

    // 本月部门支出TOP5
    const deptTop5Raw = await this.expenseRepo
      .createQueryBuilder('r')
      .select('r.department_id', 'departmentId')
      .addSelect('SUM(r.amount)', 'total')
      .where('r.occur_date >= :s AND r.occur_date < :e', { s: monthStart, e: monthEnd })
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

    // 解析收入/支出类型名称供最近流水用
    const inTypeIds = [...new Set(recentIncome.map((r) => r.incomeTypeId).filter((v) => v != null) as number[])];
    const inTypes = inTypeIds.length ? await this.incomeTypeRepo.findByIds(inTypeIds) : [];
    const inTypeMap = Object.fromEntries(inTypes.map((t) => [t.id, t.name]));

    const exTypeIds = [...new Set(recentExpense.map((r) => r.expenseTypeId).filter((v) => v != null) as number[])];
    const exTypes = exTypeIds.length ? await this.expenseTypeRepo.findByIds(exTypeIds) : [];
    const exTypeMap = Object.fromEntries(exTypes.map((t) => [t.id, t.name]));

    return {
      currentMonth: {
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
      })),
      recentExpense: recentExpense.map((r) => ({
        ...r,
        expenseTypeName: r.expenseTypeId != null ? (exTypeMap[r.expenseTypeId] ?? '') : '',
      })),
      expenseTypeTop5,
      departmentExpenseTop5: deptTop5,
    };
  }
}
