import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { SystemOption } from '../entities/system-option.entity';
import { OrderWorkflowService } from './order-workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderExt, OrderStatusTransition, SystemOption])],
  providers: [OrderWorkflowService],
  exports: [OrderWorkflowService],
})
export class OrderWorkflowModule {}

