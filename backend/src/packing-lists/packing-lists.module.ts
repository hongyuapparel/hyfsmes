import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackingList } from '../entities/packing-list.entity';
import { PackingListBox } from '../entities/packing-list-box.entity';
import { PackingListItem } from '../entities/packing-list-item.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { PackingListsController } from './packing-lists.controller';
import { PackingListsService } from './packing-lists.service';
import { PackingListsPickableService } from './packing-lists-pickable.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PackingList,
      PackingListBox,
      PackingListItem,
      InboundPending,
      FinishedGoodsStock,
      FinishedGoodsStockColorImage,
      Order,
      OrderExt,
      Product,
      User,
      UserRole,
      Role,
      RolePermission,
    ]),
    AuthModule,
  ],
  controllers: [PackingListsController],
  providers: [PackingListsService, PackingListsPickableService],
})
export class PackingListsModule {}
