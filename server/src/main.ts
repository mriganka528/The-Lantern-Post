import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = app.get(ConfigService<Environment, true>).get('PORT');
  await app.listen(port, '0.0.0.0');
  Logger.log(`Lantern Post API listening on port ${port}`, 'Bootstrap');
}

void bootstrap().catch(() => {
  // Configuration validation gives actionable errors; never log DB credentials.
  Logger.error('API startup failed. Check environment configuration and port availability.', undefined, 'Bootstrap');
  process.exitCode = 1;
});
