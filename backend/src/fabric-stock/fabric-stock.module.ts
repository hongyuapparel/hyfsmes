import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricOutbound } from '../entities/fabric-outbound.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { FabricStockController } from './fabric-stock.controller';
import { FabricStockService } from './fabric-stock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FabricStock, FabricOutbound, User, RolePermission]),
    AuthModule,
  ],
  controllers: [FabricStockController],
  providers: [FabricStockService],
})
export class FabricStockModule {}
