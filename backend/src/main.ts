import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { seedPermissions } from './database/seed-permissions';
import { seedAdmin } from './database/seed-admin';
import { seedFieldDefinitions } from './database/seed-field-definitions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  const dataSource = app.get(DataSource);
  try {
    await seedPermissions(dataSource);
    await seedAdmin(dataSource);
    await seedFieldDefinitions(dataSource);
  } catch (err) {
    console.error('[Seed] Failed:', err);
  }
  console.log(`Backend running at http://localhost:${port}`);
}
bootstrap();
