import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { SystemOption } from '../entities/system-option.entity';
import { SystemOptionsController } from './system-options.controller';
import { SystemOptionsService } from './system-options.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemOption, User, RolePermission]),
    AuthModule,
  ],
  controllers: [SystemOptionsController],
  providers: [SystemOptionsService],
  exports: [SystemOptionsService],
})
export class SystemOptionsModule {}
