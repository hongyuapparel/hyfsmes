import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncomeRecord } from '../entities/income-record.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FinanceIncomeController } from './finance-income.controller';
import { FinanceIncomeService } from './finance-income.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncomeRecord, User, RolePermission]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [FinanceIncomeController],
  providers: [FinanceIncomeService],
  exports: [FinanceIncomeService],
})
export class FinanceIncomeModule {}
