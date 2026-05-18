import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { AuthModule } from '../auth/auth.module';
import { UploadsController } from './uploads.controller';
import { UploadCleanupController } from './cleanup.controller';
import { UploadCleanupService } from './cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, RolePermission, Role]), AuthModule],
  controllers: [UploadsController, UploadCleanupController],
  providers: [UploadCleanupService],
})
export class UploadsModule {}
