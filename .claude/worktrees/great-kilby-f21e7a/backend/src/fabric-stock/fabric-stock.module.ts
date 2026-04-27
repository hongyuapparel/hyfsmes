import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricOutbound } from '../entities/fabric-outbound.entity';
import { FabricStockOperationLog } from '../entities/fabric-stock-operation-log.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Supplier } from '../entities/supplier.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { FabricStockController } from './fabric-stock.controller';
import { FabricStockService } from './fabric-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FabricStock,
      FabricOutbound,
      FabricStockOperationLog,
      User,
      RolePermission,
      Supplier,
    ]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [FabricStockController],
  providers: [FabricStockService],
  exports: [FabricStockService],
})
export class FabricStockModule {}
