import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductionCuttingController } from './production-cutting.controller';
import { ProductionCuttingService } from './production-cutting.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderCutting, OrderExt, User, RolePermission]), AuthModule],
  controllers: [ProductionCuttingController],
  providers: [ProductionCuttingService],
})
export class ProductionCuttingModule {}
