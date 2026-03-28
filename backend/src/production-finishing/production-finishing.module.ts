import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderWorkflowModule } from '../order-workflow/order-workflow.module';
import { OrderStatusConfigModule } from '../order-status-config/order-status-config.module';
import { ProductionFinishingController } from './production-finishing.controller';
import { ProductionFinishingService } from './production-finishing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderFinishing, OrderCutting, OrderExt, OrderSewing, InboundPending, User, RolePermission]),
    AuthModule,
    OrderWorkflowModule,
    OrderStatusConfigModule,
  ],
  controllers: [ProductionFinishingController],
  providers: [ProductionFinishingService],
})
export class ProductionFinishingModule {}
