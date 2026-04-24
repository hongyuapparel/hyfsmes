import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderPattern } from '../entities/order-pattern.entity';
import { Product } from '../entities/product.entity';
import { RoleOrderPolicy } from '../entities/role-order-policy.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { AuthModule } from '../auth/auth.module';
import { InventoryAccessoriesModule } from '../inventory-accessories/inventory-accessories.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { OrdersController } from './orders.controller';
import { OrderCostController } from './order-cost.controller';
import { OrdersService } from './orders.service';
import { OrderQueryService } from './order-query.service';
import { OrderMutationService } from './order-mutation.service';
import { OrderStatusService } from './order-status.service';

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
      OrderPattern,
      User,
      RolePermission,
      RoleOrderPolicy,
      OrderStatus,
      OrderStatusHistory,
      OrderStatusTransition,
      Product,
      Role,
      UserRole,
    ]),
    AuthModule,
    InventoryAccessoriesModule,
    SystemOptionsModule,
    OrderWorkflowModule,
    SuppliersModule,
  ],
  controllers: [OrdersController, OrderCostController],
  providers: [OrdersService, OrderQueryService, OrderMutationService, OrderStatusService],
  exports: [OrdersService, OrderQueryService, OrderMutationService, OrderStatusService],
})
export class OrdersModule {}
