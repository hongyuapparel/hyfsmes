import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, RolePermission]), AuthModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
