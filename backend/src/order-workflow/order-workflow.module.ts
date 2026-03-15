import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { SystemOption } from '../entities/system-option.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { OrderWorkflowService } from './order-workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderStatusTransition, SystemOption, User, Role])],
  providers: [OrderWorkflowService],
  exports: [OrderWorkflowService],
})
export class OrderWorkflowModule {}

