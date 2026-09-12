import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CASH_KINDS, financeDate, financeToday } from '../common/finance-value.util';
import { FinanceControlService } from './finance-control.service';

const FLOWS = `(SELECT id,occur_date,amount,department_id,fund_account_id,cash_kind,'income' direction FROM finance_income_records WHERE deleted_at IS NULL
 UNION ALL SELECT id,occur_date,amount,department_id,fund_account_id,cash_kind,'expense' direction FROM finance_expense_records WHERE deleted_at IS NULL)`;
const SUMS = `COALESCE(SUM(IF(direction='income',amount,0)),0) totalIncome,
 COALESCE(SUM(IF(direction='expense',amount,0)),0) totalExpense,
 COALESCE(SUM(IF(direction='income',amount,-amount)),0) netCashFlow`;
export interface Totals { totalIncome: string; totalExpense: string; netCashFlow: string }
export interface Dept extends Totals { departmentId: number | null; departmentName: string }

@Injectable()
export class FinanceDashboardService {
  constructor(private readonly db: DataSource, private readonly control: FinanceControlService) {}
  async getSummary(params?: { dateFrom?: string; dateTo?: string; cashKind?: string }) {
    const today = financeToday();
    const dateFrom = financeDate(params?.dateFrom || today.slice(0,4) + '-01-01');
    const requestedTo = financeDate(params?.dateTo || today);
    const dateTo = requestedTo > today ? today : requestedTo;
    if (dateFrom > dateTo) throw new BadRequestException('开始日期不能晚于结束日期或今天');
    if ((Date.parse(dateTo)-Date.parse(dateFrom))/86400000 > 3660) throw new BadRequestException('单次统计区间不能超过十年');
    const cashKind = params?.cashKind || '';
    if (cashKind && !CASH_KINDS.includes(cashKind as typeof CASH_KINDS[number])) throw new BadRequestException('收支性质无效');
    const clause = `occur_date BETWEEN ? AND ?${cashKind ? ' AND cash_kind=?' : ''}`;
    const args = [dateFrom, dateTo, ...(cashKind ? [cashKind] : [])];
    const duration = Date.parse(dateTo)-Date.parse(dateFrom)+86400000;
    const previousTo = new Date(Date.parse(dateFrom)-86400000).toISOString().slice(0,10);
    const previousFrom = new Date(Date.parse(dateFrom)-duration).toISOString().slice(0,10);
    const result = await this.db.transaction('REPEATABLE READ', async manager => {
      const totals: Totals[] = await manager.query(`SELECT ${SUMS} FROM ${FLOWS} f WHERE ${clause}`,args);
      const previous: Totals[] = await manager.query(`SELECT ${SUMS} FROM ${FLOWS} f WHERE ${clause}`,[previousFrom,previousTo,...(cashKind ? [cashKind] : [])]);
      const departments: Dept[] = await manager.query(`SELECT department_id departmentId,
        CASE WHEN department_id IS NULL THEN '待归属' ELSE COALESCE(d.value,CONCAT('未知部门 #',department_id)) END departmentName, ${SUMS}
        FROM ${FLOWS} f LEFT JOIN system_options d ON d.id=f.department_id AND d.option_type='org_departments'
        WHERE ${clause} GROUP BY department_id,d.value ORDER BY totalExpense DESC,totalIncome DESC`,args);
      const previousDepartments: Dept[] = await manager.query(`SELECT department_id departmentId,${SUMS} FROM ${FLOWS} f WHERE ${clause} GROUP BY department_id`,[previousFrom,previousTo,...(cashKind ? [cashKind] : [])]);
      const trend: (Totals & { month: string })[] = await manager.query(`SELECT DATE_FORMAT(occur_date,'%Y-%m') month,${SUMS} FROM ${FLOWS} f WHERE ${clause} GROUP BY month ORDER BY month`,args);
      const nature: (Totals & { cashKind: string })[] = await manager.query(`SELECT cash_kind cashKind,${SUMS} FROM ${FLOWS} f WHERE occur_date BETWEEN ? AND ? GROUP BY cash_kind`,[dateFrom,dateTo]);
      const quality: { incomeCount: string; expenseCount: string; unclassified: string; missingAccount: string; missingDepartment: string; unknownDepartment: string; latest: string | null }[] = await manager.query(`SELECT
        COUNT(IF(direction='income',1,NULL)) incomeCount,COUNT(IF(direction='expense',1,NULL)) expenseCount,
        COUNT(IF(cash_kind='unclassified',1,NULL)) unclassified,
        COUNT(IF(a.id IS NULL,1,NULL)) missingAccount,
        COUNT(IF(department_id IS NULL,1,NULL)) missingDepartment,
        COUNT(IF(department_id IS NOT NULL AND d.id IS NULL,1,NULL)) unknownDepartment,
        DATE_FORMAT(MAX(occur_date),'%Y-%m-%d') latest
        FROM ${FLOWS} f LEFT JOIN finance_fund_accounts a ON a.id=f.fund_account_id
        LEFT JOIN system_options d ON d.id=f.department_id AND d.option_type='org_departments'
        WHERE occur_date BETWEEN ? AND ?`,[dateFrom,dateTo]);
      const monthMap = new Map(trend.map(row => [row.month,row]));
      const months: (Totals & { month: string })[] = [];
      for (let date=new Date(dateFrom.slice(0,7)+'-01'); date.toISOString().slice(0,7)<=dateTo.slice(0,7); date.setUTCMonth(date.getUTCMonth()+1)) {
        const month=date.toISOString().slice(0,7);
        months.push(monthMap.get(month) || {month,totalIncome:'0.00',totalExpense:'0.00',netCashFlow:'0.00'});
      }
      const accounts = await this.control.accounts(today, manager);
      const [unassigned]: {total:string}[] = await manager.query(`SELECT COUNT(*) total FROM ${FLOWS} f LEFT JOIN finance_fund_accounts a ON a.id=f.fund_account_id WHERE a.id IS NULL AND occur_date<=?`,[today]);
      const complete = Number(unassigned.total)===0 && accounts.length>0 && accounts.every(a=>a.bookBalance!==null);
      const currentBookBalance = complete ? (accounts.reduce((sum,a)=>sum+Math.round(Number(a.bookBalance)*100),0)/100).toFixed(2) : null;
      return { accounts, currentBookBalance, period:{dateFrom,dateTo}, cashKind, periodSummary:totals[0], previous:{period:{dateFrom:previousFrom,dateTo:previousTo},...previous[0]},
        departments:departments.map(row=>({...row,previous:previousDepartments.find(p=>p.departmentId===row.departmentId) || {totalIncome:'0.00',totalExpense:'0.00',netCashFlow:'0.00'}})),
        trend:months, nature, quality:quality[0] };
    });
    return {...result, generatedAt:new Date().toISOString()};
  }
}
