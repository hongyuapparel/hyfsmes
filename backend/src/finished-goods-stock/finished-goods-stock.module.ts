import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { FinishedGoodsStockController } from './finished-goods-stock.controller';
import { FinishedGoodsStockService } from './finished-goods-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinishedGoodsStock,
      FinishedGoodsOutbound,
      FinishedGoodsStockColorImage,
      FinishedGoodsStockAdjustLog,
      InboundPending,
      Order,
      OrderExt,
      Product,
      User,
      RolePermission,
    ]),
    AuthModule,
  ],
  controllers: [FinishedGoodsStockController],
  providers: [FinishedGoodsStockService],
})
export class FinishedGoodsStockModule {}
