import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { InventoryAccessoriesController } from './inventory-accessories.controller';
import { InventoryAccessoriesService } from './inventory-accessories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryAccessory, User, RolePermission]),
    AuthModule,
  ],
  controllers: [InventoryAccessoriesController],
  providers: [InventoryAccessoriesService],
})
export class InventoryAccessoriesModule {}
