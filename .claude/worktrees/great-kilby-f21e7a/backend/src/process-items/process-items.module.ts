import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProcessItemsController } from './process-items.controller';
import { ProcessItemsService } from './process-items.service';
import { SystemOptionsModule } from '../system-options/system-options.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RolePermission]),
    AuthModule,
    SystemOptionsModule,
  ],
  controllers: [ProcessItemsController],
  providers: [ProcessItemsService],
  exports: [ProcessItemsService],
})
export class ProcessItemsModule {}

