import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessQuoteTemplate } from '../entities/process-quote-template.entity';
import { ProcessQuoteTemplateItem } from '../entities/process-quote-template-item.entity';
import { ProductionProcess } from '../entities/production-process.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { ProcessQuoteTemplatesController } from './process-quote-templates.controller';
import { ProcessQuoteTemplatesService } from './process-quote-templates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessQuoteTemplate,
      ProcessQuoteTemplateItem,
      ProductionProcess,
      User,
      RolePermission,
    ]),
    AuthModule,
  ],
  controllers: [ProcessQuoteTemplatesController],
  providers: [ProcessQuoteTemplatesService],
  exports: [ProcessQuoteTemplatesService],
})
export class ProcessQuoteTemplatesModule {}
