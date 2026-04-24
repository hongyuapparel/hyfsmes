import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { OrderWorkflowChain } from '../entities/order-workflow-chain.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { OrderStatusConfigService } from './order-status-config.service';
import { OrderStatusConfigController } from './order-status-config.controller';
import { OrderStatusDefinitionService } from './order-status-definition.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { OrderStatusReportService } from './order-status-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderStatus,
      OrderStatusTransition,
      OrderWorkflowChain,
      OrderStatusSla,
      OrderStatusHistory,
      Order,
      OrderCostSnapshot,
    ]),
    SystemOptionsModule,
  ],
  providers: [
    OrderStatusConfigService,
    OrderStatusDefinitionService,
    OrderStatusTransitionService,
    OrderStatusReportService,
  ],
  controllers: [OrderStatusConfigController],
  exports: [
    OrderStatusConfigService,
    OrderStatusDefinitionService,
    OrderStatusTransitionService,
    OrderStatusReportService,
  ],
})
export class OrderStatusConfigModule {}

