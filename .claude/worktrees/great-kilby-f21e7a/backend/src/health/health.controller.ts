import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private dataSource: DataSource) {}

  @Get()
  check() {
    return { status: 'ok' };
  }

  @Get('db')
  async checkDb() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch (e) {
      return { status: 'error', db: 'disconnected', message: (e as Error).message };
    }
  }
}
