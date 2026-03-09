import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Customer } from './entities/customer.entity';
import { Product } from './entities/product.entity';
import { FieldDefinition } from './entities/field-definition.entity';
import { SystemOption } from './entities/system-option.entity';
import { Order } from './entities/order.entity';
import { OrderExt } from './entities/order-ext.entity';
import { OrderOperationLog } from './entities/order-operation-log.entity';
import { OrderCraft } from './entities/order-craft.entity';
import { OrderCutting } from './entities/order-cutting.entity';
import { OrderPattern } from './entities/order-pattern.entity';
import { OrderFinishing } from './entities/order-finishing.entity';
import { OrderRemark } from './entities/order-remark.entity';
import { OrderSewing } from './entities/order-sewing.entity';
import { ProductionProcess } from './entities/production-process.entity';
import { InboundPending } from './entities/inbound-pending.entity';
import { FinishedGoodsStock } from './entities/finished-goods-stock.entity';
import { InventoryAccessory } from './entities/inventory-accessory.entity';
import { FabricStock } from './entities/fabric-stock.entity';
import { FabricOutbound } from './entities/fabric-outbound.entity';
import { Employee } from './entities/employee.entity';
import { Supplier } from './entities/supplier.entity';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { FieldDefinitionsModule } from './field-definitions/field-definitions.module';
import { UploadsModule } from './uploads/uploads.module';
import { OrdersModule } from './orders/orders.module';
import { ProductionProcessesModule } from './production-processes/production-processes.module';
import { ProductionPurchaseModule } from './production-purchase/production-purchase.module';
import { ProductionPatternModule } from './production-pattern/production-pattern.module';
import { ProductionCraftModule } from './production-craft/production-craft.module';
import { ProductionCuttingModule } from './production-cutting/production-cutting.module';
import { ProductionSewingModule } from './production-sewing/production-sewing.module';
import { ProductionFinishingModule } from './production-finishing/production-finishing.module';
import { DictsModule } from './dicts/dicts.module';
import { InventoryPendingModule } from './inventory-pending/inventory-pending.module';
import { FinishedGoodsStockModule } from './finished-goods-stock/finished-goods-stock.module';
import { InventoryAccessoriesModule } from './inventory-accessories/inventory-accessories.module';
import { FabricStockModule } from './fabric-stock/fabric-stock.module';
import { HrModule } from './hr/hr.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'erp',
      entities: [User, Role, Permission, RolePermission, Customer, Product, FieldDefinition, SystemOption, Order, OrderExt, OrderOperationLog, OrderCraft, OrderCutting, OrderFinishing, OrderPattern, OrderRemark, OrderSewing, ProductionProcess, InboundPending, FinishedGoodsStock, InventoryAccessory, FabricStock, FabricOutbound, Employee, Supplier],
      synchronize: process.env.NODE_ENV !== 'production',
      charset: 'utf8mb4',
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CustomersModule,
    ProductsModule,
    FieldDefinitionsModule,
    UploadsModule,
    OrdersModule,
    ProductionProcessesModule,
    ProductionPurchaseModule,
    ProductionPatternModule,
    ProductionCraftModule,
    ProductionCuttingModule,
    ProductionSewingModule,
    ProductionFinishingModule,
    DictsModule,
    InventoryPendingModule,
    FinishedGoodsStockModule,
    InventoryAccessoriesModule,
    FabricStockModule,
    HrModule,
    SuppliersModule,
  ],
})
export class AppModule {}
