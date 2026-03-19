import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { AuthModule } from '../auth/auth.module';
import { InventoryAccessoriesModule } from '../inventory-accessories/inventory-accessories.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { OrdersController } from './orders.controller';
import { OrderCostController } from './order-cost.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderExt,
      OrderOperationLog,
      OrderRemark,
      OrderCostSnapshot,
      OrderCutting,
      OrderSewing,
      OrderFinishing,
      OrderCraft,
      User,
      RolePermission,
      OrderStatus,
      OrderStatusHistory,
    ]),
    AuthModule,
    InventoryAccessoriesModule,
    SystemOptionsModule,
    OrderWorkflowModule,
  ],
  controllers: [OrdersController, OrderCostController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

