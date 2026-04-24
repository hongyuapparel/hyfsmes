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
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FabricStockModule } from '../fabric-stock/fabric-stock.module';
import { InventoryAccessoriesModule } from '../inventory-accessories/inventory-accessories.module';
import { FinishedGoodsStockModule } from '../finished-goods-stock/finished-goods-stock.module';
import { OrderStatusConfigModule } from '../order-status-config/order-status-config.module';
import { ProductionPurchaseController } from './production-purchase.controller';
import { ProductionPurchaseService } from './production-purchase.service';
import { ProductionPurchaseQueryService } from './production-purchase-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderExt, OrderStatus, OrderStatusHistory, User, RolePermission]),
    AuthModule,
    OrderWorkflowModule,
    SuppliersModule,
    SystemOptionsModule,
    FabricStockModule,
    InventoryAccessoriesModule,
    FinishedGoodsStockModule,
    OrderStatusConfigModule,
  ],
  controllers: [ProductionPurchaseController],
  providers: [ProductionPurchaseService, ProductionPurchaseQueryService],
})
export class ProductionPurchaseModule {}
