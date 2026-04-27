import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemOptionsModule } from '../system-options/system-options.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { DictsController } from './dicts.controller';

@Module({
  imports: [SystemOptionsModule, AuthModule, TypeOrmModule.forFeature([User, RolePermission])],
  controllers: [DictsController],
})
export class DictsModule {}

