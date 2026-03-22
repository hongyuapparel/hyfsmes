import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { FinanceIncomeType } from '../entities/finance-income-type.entity';
import { FinanceFundAccount } from '../entities/finance-fund-account.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { FinanceIncomeController } from './finance-income.controller';
import { FinanceIncomeService } from './finance-income.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncomeRecord, FinanceIncomeType, FinanceFundAccount, User, RolePermission]),
    AuthModule,
  ],
  controllers: [FinanceIncomeController],
  providers: [FinanceIncomeService],
  exports: [FinanceIncomeService],
})
export class FinanceIncomeModule {}
