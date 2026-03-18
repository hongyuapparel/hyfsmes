import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { ProductionCraftController } from './production-craft.controller';
import { ProductionCraftService } from './production-craft.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderCraft, OrderExt, User, RolePermission]),
    AuthModule,
    OrderWorkflowModule,
  ],
  controllers: [ProductionCraftController],
  providers: [ProductionCraftService],
})
export class ProductionCraftModule {}
