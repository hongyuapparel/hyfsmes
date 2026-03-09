import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductionPurchaseController } from './production-purchase.controller';
import { ProductionPurchaseService } from './production-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderExt, User, RolePermission]),
    AuthModule,
  ],
  controllers: [ProductionPurchaseController],
  providers: [ProductionPurchaseService],
})
export class ProductionPurchaseModule {}
