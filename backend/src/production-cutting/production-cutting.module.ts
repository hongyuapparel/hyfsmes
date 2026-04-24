import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { OrderStatusConfigModule } from '../order-status-config/order-status-config.module';
import { ProductionCuttingController } from './production-cutting.controller';
import { ProductionCuttingService } from './production-cutting.service';
import { ProductionCuttingListService } from './production-cutting-list.service';
import { ProductionCuttingQueryService } from './production-cutting-query.service';
import { ProductionCuttingMutationService } from './production-cutting-mutation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderCutting, OrderExt, OrderStatus, OrderStatusHistory, User, RolePermission]),
    AuthModule,
    OrderWorkflowModule,
    SystemOptionsModule,
    OrderStatusConfigModule,
  ],
  controllers: [ProductionCuttingController],
  providers: [
    ProductionCuttingService,
    ProductionCuttingListService,
    ProductionCuttingQueryService,
    ProductionCuttingMutationService,
  ],
})
export class ProductionCuttingModule {}
