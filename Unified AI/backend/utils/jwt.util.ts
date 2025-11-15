import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

export interface TokenPayload {
  userId: string;
  email: string;
  displayName: string;
  type: 'access' | 'refresh';
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export class JWTUtil {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    // Access token secret
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateDefaultSecret('access');
    if (!process.env.JWT_ACCESS_SECRET) {
      console.warn('JWT_ACCESS_SECRET not set, using generated secret (not suitable for production)');
    }

    // Refresh token secret
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateDefaultSecret('refresh');
    if (!process.env.JWT_REFRESH_SECRET) {
      console.warn('JWT_REFRESH_SECRET not set, using generated secret (not suitable for production)');
    }

    // Token expiry times
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m'; // 15 minutes
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d'; // 7 days
  }

  /**
   * Generate a default secret for development (not for production use)
   */
  private generateDefaultSecret(type: string): string {
    return crypto
      .createHash('sha256')
      .update(`unified-ai-hub-${type}-${Date.now()}`)
      .digest('hex');
  }

  /**
   * Generate an access token (short-lived, 15 minutes)
   */
  generateAccessToken(userId: string, email: string, displayName: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      displayName,
      type: 'access'
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'unified-ai-hub',
      audience: 'unified-ai-hub-users'
    });
  }

  /**
   * Generate a refresh token (long-lived, 7 days)
   */
  generateRefreshToken(userId: string, email: string, displayName: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      displayName,
      type: 'refresh'
    };

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'unified-ai-hub',
      audience: 'unified-ai-hub-users'
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userId: string, email: string, displayName: string): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.generateAccessToken(userId, email, displayName),
      refreshToken: this.generateRefreshToken(userId, email, displayName)
    };
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'unified-ai-hub',
        audience: 'unified-ai-hub-users'
      }) as DecodedToken;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Verify and decode a refresh token
   */
  verifyRefreshToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'unified-ai-hub',
        audience: 'unified-ai-hub-users'
      }) as DecodedToken;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Decode a token without verifying (useful for debugging)
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      const decoded = jwt.decode(token) as DecodedToken;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract user ID from a token without full verification
   */
  extractUserId(token: string): string | null {
    const decoded = this.decodeToken(token);
    return decoded?.userId || null;
  }

  /**
   * Extract user info from a token without full verification
   */
  extractUserInfo(token: string): Pick<TokenPayload, 'userId' | 'email' | 'displayName'> | null {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      displayName: decoded.displayName
    };
  }

  /**
   * Check if a token is expired without verifying signature
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  /**
   * Get time remaining until token expires (in seconds)
   */
  getTimeUntilExpiry(token: string): number | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const remaining = decoded.exp - currentTime;
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Generate a secure random token for email verification or password reset
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Hash a token for storage (e.g., refresh tokens in database)
   */
  hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }
}

// Singleton instance
export const jwtUtil = new JWTUtil();
