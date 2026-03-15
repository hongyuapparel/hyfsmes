import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseRecord } from '../entities/expense-record.entity';
import { Order } from '../entities/order.entity';
import { Supplier } from '../entities/supplier.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FinanceExpenseController } from './finance-expense.controller';
import { FinanceExpenseService } from './finance-expense.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseRecord, Order, Supplier, User, RolePermission]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [FinanceExpenseController],
  providers: [FinanceExpenseService],
  exports: [FinanceExpenseService],
})
export class FinanceExpenseModule {}
