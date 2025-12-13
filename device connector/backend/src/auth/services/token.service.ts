import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as crypto from 'crypto';

export interface TokenPayload {
  sub: string; // user ID
  deviceId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate access and refresh token pair
   * @param userId User ID
   * @param deviceId Device ID
   * @returns Token pair with access token, refresh token, and expiry
   */
  async generateTokenPair(userId: string, deviceId: string): Promise<TokenPair> {
    const accessTokenExpiresIn = this.configService.get<number>('auth.jwtExpiresIn', 900);
    const refreshTokenExpiresIn = this.configService.get<number>(
      'auth.refreshTokenExpiresIn',
      604800,
    );

    const accessToken = await this.generateAccessToken(userId, deviceId, accessTokenExpiresIn);
    const refreshToken = await this.generateRefreshToken(userId, deviceId, refreshTokenExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpiresIn,
    };
  }

  /**
   * Generate access token
   * @param userId User ID
   * @param deviceId Device ID
   * @param expiresIn Expiry time in seconds
   * @returns JWT access token
   */
  private async generateAccessToken(
    userId: string,
    deviceId: string,
    expiresIn: number,
  ): Promise<string> {
    const payload: TokenPayload = {
      sub: userId,
      deviceId,
      type: 'access',
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: `${expiresIn}s`,
      secret: this.configService.get<string>('auth.jwtSecret'),
    });
  }

  /**
   * Generate refresh token
   * @param userId User ID
   * @param deviceId Device ID
   * @param expiresIn Expiry time in seconds
   * @returns JWT refresh token
   */
  private async generateRefreshToken(
    userId: string,
    deviceId: string,
    expiresIn: number,
  ): Promise<string> {
    const payload: TokenPayload = {
      sub: userId,
      deviceId,
      type: 'refresh',
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: `${expiresIn}s`,
      secret: this.configService.get<string>('auth.jwtSecret'),
    });
  }

  /**
   * Verify and decode a JWT token
   * @param token JWT token
   * @returns Decoded token payload
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('auth.jwtSecret'),
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Hash a token for storage (SHA-256)
   * @param token Plain token
   * @returns Hashed token
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a random token (for email verification, password reset, etc.)
   * @param length Length of token in bytes (default 32)
   * @returns Random token as hex string
   */
  generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Calculate token expiry date
   * @param expiresIn Expiry time in seconds
   * @returns Expiry date
   */
  calculateExpiryDate(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Check if a token is expired
   * @param expiresAt Expiry date
   * @returns True if expired, false otherwise
   */
  isExpired(expiresAt: Date): boolean {
    return new Date() > new Date(expiresAt);
  }
}
