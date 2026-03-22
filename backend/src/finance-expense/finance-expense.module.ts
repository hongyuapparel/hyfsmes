import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseRecord } from '../entities/expense-record.entity';
import { FinanceExpenseType } from '../entities/finance-expense-type.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FinanceExpenseController } from './finance-expense.controller';
import { FinanceExpenseService } from './finance-expense.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseRecord, FinanceExpenseType, FinanceFundAccount, User, RolePermission]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [FinanceExpenseController],
  providers: [FinanceExpenseService],
  exports: [FinanceExpenseService],
})
export class FinanceExpenseModule {}
