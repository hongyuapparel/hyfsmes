import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceExpenseType } from '../entities/finance-expense-type.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FinanceSettingsController } from './finance-settings.controller';
import { FinanceSettingsService } from './finance-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceFundAccount, FinanceIncomeType, FinanceExpenseType, User, RolePermission]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [FinanceSettingsController],
  providers: [FinanceSettingsService],
  exports: [FinanceSettingsService],
})
export class FinanceSettingsModule {}
