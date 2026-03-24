import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';
import { Role } from '../entities/role.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { InventoryPendingController } from './inventory-pending.controller';
import { InventoryPendingService } from './inventory-pending.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InboundPending,
      FinishedGoodsStock,
      FinishedGoodsOutbound,
      Order,
      Product,
      User,
      Role,
      RolePermission,
    ]),
    AuthModule,
  ],
  controllers: [InventoryPendingController],
  providers: [InventoryPendingService],
})
export class InventoryPendingModule {}
