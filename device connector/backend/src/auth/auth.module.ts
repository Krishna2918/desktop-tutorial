import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../database/entities/user.entity';
import { DeviceEntity } from '../database/entities/device.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, DeviceEntity, SessionEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: `${configService.get<number>('auth.jwtExpiresIn')}s`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy],
  exports: [AuthService, PasswordService, TokenService, JwtStrategy],
})
export class AuthModule {}
