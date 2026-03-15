import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductionSewingController } from './production-sewing.controller';
import { ProductionSewingService } from './production-sewing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderSewing, OrderCutting, OrderExt, User, RolePermission]),
    AuthModule,
  ],
  controllers: [ProductionSewingController],
  providers: [ProductionSewingService],
})
export class ProductionSewingModule {}
