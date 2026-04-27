import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionProcess } from '../entities/production-process.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductionProcessesController } from './production-processes.controller';
import { ProductionProcessesService } from './production-processes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductionProcess, User, RolePermission]),
    AuthModule,
  ],
  controllers: [ProductionProcessesController],
  providers: [ProductionProcessesService],
  exports: [ProductionProcessesService],
})
export class ProductionProcessesModule {}
