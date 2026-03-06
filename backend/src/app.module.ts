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
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { FieldDefinitionsModule } from './field-definitions/field-definitions.module';
import { UploadsModule } from './uploads/uploads.module';
import { OrdersModule } from './orders/orders.module';
import { DictsModule } from './dicts/dicts.module';

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
      entities: [User, Role, Permission, RolePermission, Customer, Product, FieldDefinition, SystemOption, Order],
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
    DictsModule,
  ],
})
export class AppModule {}
