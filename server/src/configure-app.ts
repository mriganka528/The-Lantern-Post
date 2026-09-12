import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Environment } from './config/environment';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Environment, true>);
  app.enableCors({
    origin: config.get('WEB_ORIGINS'),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
  });
  if (config.get('NODE_ENV') !== 'production') {
    const schema = new DocumentBuilder()
      .setTitle('Lantern Post API')
      .setDescription('Lantern Post identity, palaces, friendships, private letter delivery and reading, device notifications, stationery, and irreversible Burning World releases. Private endpoints require a verified Clerk session.')
      .setVersion('0.6.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Clerk session token from the mobile client.' }, 'clerk-session')
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, schema));
  }
}
