import { Module } from '@nestjs/common';
import { ProcessItemsController } from './process-items.controller';
import { ProcessItemsService } from './process-items.service';
import { SystemOptionsModule } from '../system-options/system-options.module';

@Module({
  imports: [SystemOptionsModule],
  controllers: [ProcessItemsController],
  providers: [ProcessItemsService],
  exports: [ProcessItemsService],
})
export class ProcessItemsModule {}

