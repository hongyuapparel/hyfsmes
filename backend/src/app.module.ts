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
import { OrderCostSnapshot } from './entities/order-cost-snapshot.entity';
import { OrderSewing } from './entities/order-sewing.entity';
import { ProductionProcess } from './entities/production-process.entity';
import { ProcessQuoteTemplate } from './entities/process-quote-template.entity';
import { ProcessQuoteTemplateItem } from './entities/process-quote-template-item.entity';
import { InboundPending } from './entities/inbound-pending.entity';
import { FinishedGoodsStock } from './entities/finished-goods-stock.entity';
import { FinishedGoodsOutbound } from './entities/finished-goods-outbound.entity';
import { InventoryAccessory } from './entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from './entities/inventory-accessory-outbound.entity';
import { FabricStock } from './entities/fabric-stock.entity';
import { FabricOutbound } from './entities/fabric-outbound.entity';
import { Employee } from './entities/employee.entity';
import { Supplier } from './entities/supplier.entity';
import { OrderStatus } from './entities/order-status.entity';
import { OrderStatusTransition } from './entities/order-status-transition.entity';
import { OrderWorkflowChain } from './entities/order-workflow-chain.entity';
import { OrderStatusSla } from './entities/order-status-sla.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { FieldDefinitionsModule } from './field-definitions/field-definitions.module';
import { UploadsModule } from './uploads/uploads.module';
import { OrdersModule } from './orders/orders.module';
import { ProductionProcessesModule } from './production-processes/production-processes.module';
import { ProcessQuoteTemplatesModule } from './process-quote-templates/process-quote-templates.module';
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
import { OrderStatusConfigModule } from './order-status-config/order-status-config.module';
import { IncomeRecord } from './entities/income-record.entity';
import { ExpenseRecord } from './entities/expense-record.entity';
import { FinanceFundAccount } from './entities/finance-fund-account.entity';
import { FinanceIncomeType } from './entities/finance-income-type.entity';
import { FinanceExpenseType } from './entities/finance-expense-type.entity';
import { FinishedGoodsStockColorImage } from './entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from './entities/finished-goods-stock-adjust-log.entity';
import { RoleOrderPolicy } from './entities/role-order-policy.entity';
import { FinanceIncomeModule } from './finance-income/finance-income.module';
import { FinanceExpenseModule } from './finance-expense/finance-expense.module';
import { FinanceSettingsModule } from './finance-settings/finance-settings.module';
import { FinanceDashboardModule } from './finance-dashboard/finance-dashboard.module';

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
      entities: [User, Role, Permission, RolePermission, Customer, Product, FieldDefinition, SystemOption, Order, OrderExt, OrderOperationLog, OrderCostSnapshot, OrderCraft, OrderCutting, OrderFinishing, OrderPattern, OrderRemark, OrderSewing, ProductionProcess, ProcessQuoteTemplate, ProcessQuoteTemplateItem, InboundPending, FinishedGoodsStock, FinishedGoodsOutbound, FinishedGoodsStockColorImage, FinishedGoodsStockAdjustLog, InventoryAccessory, InventoryAccessoryOutbound, FabricStock, FabricOutbound, Employee, Supplier, OrderStatus, OrderStatusTransition, OrderWorkflowChain, OrderStatusSla, OrderStatusHistory, IncomeRecord, ExpenseRecord, FinanceFundAccount, FinanceIncomeType, FinanceExpenseType, RoleOrderPolicy],
      // 默认关闭，避免已有库在启动时重复建表/建索引导致启动失败。
      // 如需同步结构：设置 TYPEORM_SYNCHRONIZE=true（仅建议本地开发库使用）。
      synchronize: (process.env.TYPEORM_SYNCHRONIZE ?? '').toLowerCase() === 'true',
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
    ProcessQuoteTemplatesModule,
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
    OrderStatusConfigModule,
    FinanceIncomeModule,
    FinanceExpenseModule,
    FinanceSettingsModule,
    FinanceDashboardModule,
  ],
})
export class AppModule {}
