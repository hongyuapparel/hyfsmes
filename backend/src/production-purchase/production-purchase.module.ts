import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ProductionPurchaseController } from './production-purchase.controller';
import { ProductionPurchaseService } from './production-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderExt, OrderStatus, OrderStatusHistory, User, RolePermission]),
    AuthModule,
    OrderWorkflowModule,
    SuppliersModule,
  ],
  controllers: [ProductionPurchaseController],
  providers: [ProductionPurchaseService],
})
export class ProductionPurchaseModule {}
