import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FieldDefinition } from '../entities/field-definition.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { FieldDefinitionsService } from './field-definitions.service';
import { FieldDefinitionsController } from './field-definitions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FieldDefinition, User, RolePermission]), AuthModule],
  controllers: [FieldDefinitionsController],
  providers: [FieldDefinitionsService],
  exports: [FieldDefinitionsService],
})
export class FieldDefinitionsModule {}
