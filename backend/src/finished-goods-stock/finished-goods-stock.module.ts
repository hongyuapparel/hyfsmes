import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { FinishedGoodsStockController } from './finished-goods-stock.controller';
import { FinishedGoodsStockService } from './finished-goods-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinishedGoodsStock, InboundPending, Order, User, RolePermission]),
    AuthModule,
  ],
  controllers: [FinishedGoodsStockController],
  providers: [FinishedGoodsStockService],
})
export class FinishedGoodsStockModule {}
