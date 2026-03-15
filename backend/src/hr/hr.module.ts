import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../entities/employee.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { SystemOptionsModule } from '../system-options/system-options.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, User, RolePermission]),
    AuthModule,
    UsersModule,
    SystemOptionsModule,
  ],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
