import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { ExpenseRecord } from '../entities/expense-record.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceExpenseType } from '../entities/finance-expense-type.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FinanceDashboardController } from './finance-dashboard.controller';
import { FinanceDashboardService } from './finance-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IncomeRecord, ExpenseRecord,
      FinanceFundAccount, FinanceIncomeType, FinanceExpenseType,
      User, RolePermission,
    ]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [FinanceDashboardController],
  providers: [FinanceDashboardService],
})
export class FinanceDashboardModule {}
