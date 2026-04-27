import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { XiaomanService } from './xiaoman.service';

@Module({
  imports: [ConfigModule],
  providers: [XiaomanService],
  exports: [XiaomanService],
})
export class XiaomanModule {}
