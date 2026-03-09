import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderPattern } from '../entities/order-pattern.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductionPatternController } from './production-pattern.controller';
import { ProductionPatternService } from './production-pattern.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderPattern, OrderExt, User, RolePermission]),
    AuthModule,
  ],
  controllers: [ProductionPatternController],
  providers: [ProductionPatternService],
})
export class ProductionPatternModule {}
