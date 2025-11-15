import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  app.useLogger(logger);

  // Security
  if (configService.get<boolean>('HELMET_ENABLED', true)) {
    app.use(helmet());
  }

  // Compression
  if (configService.get<boolean>('COMPRESSION_ENABLED', true)) {
    app.use(compression());
  }

  // CORS
  if (configService.get<boolean>('CORS_ENABLED', true)) {
    const origins = configService.get<string>('CORS_ORIGINS', '*').split(',');
    app.enableCors({
      origin: origins,
      credentials: true,
    });
  }

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', '/api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Universal Device Connector API')
    .setDescription(
      'RESTful API for cross-platform device sync and control application',
    )
    .setVersion(configService.get<string>('APP_VERSION', '0.1.0'))
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication and authorization')
    .addTag('devices', 'Device management')
    .addTag('files', 'File transfer and storage')
    .addTag('remote-control', 'Remote control sessions')
    .addTag('sync', 'Clipboard and data synchronization')
    .addTag('health', 'Health checks and monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'UDC API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`, 'Bootstrap');
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`, 'Bootstrap');
  logger.log(`🏥 Health Check: http://localhost:${port}${apiPrefix}/health`, 'Bootstrap');
  logger.log(`🌍 Environment: ${configService.get<string>('NODE_ENV')}`, 'Bootstrap');
}

bootstrap();
