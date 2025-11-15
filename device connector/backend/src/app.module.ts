import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { LoggerService } from './common/services/logger.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { entities } from './database/entities';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: entities,
        synchronize: configService.get('nodeEnv') === 'development',
        logging: configService.get('nodeEnv') === 'development',
        ssl: configService.get('database.ssl'),
        extra: {
          min: configService.get('database.pool.min'),
          max: configService.get('database.pool.max'),
        },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get('rateLimit.ttl'),
        limit: configService.get('rateLimit.max'),
      }),
    }),

    // Feature modules
    HealthModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService],
  exports: [LoggerService],
})
export class AppModule {}
