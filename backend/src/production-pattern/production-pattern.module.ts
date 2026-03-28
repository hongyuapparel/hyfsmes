import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderPattern } from '../entities/order-pattern.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { OrderStatusConfigModule } from '../order-status-config/order-status-config.module';
import { ProductionPatternController } from './production-pattern.controller';
import { ProductionPatternService } from './production-pattern.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderPattern, OrderExt, OrderStatus, OrderStatusHistory, User, RolePermission]),
    AuthModule,
    OrderWorkflowModule,
    OrderStatusConfigModule,
  ],
  controllers: [ProductionPatternController],
  providers: [ProductionPatternService],
})
export class ProductionPatternModule {}
