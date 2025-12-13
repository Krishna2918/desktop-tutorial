/**
 * Session and authentication types
 */

export type SessionStatus = 'active' | 'expired' | 'revoked';

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionStatus: SessionStatus;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginDto {
  email: string;
  password: string;
  deviceInfo: {
    deviceName: string;
    deviceType: string;
    osVersion: string;
    appVersion: string;
  };
}

export interface OAuthLoginDto {
  provider: 'google' | 'apple';
  code: string;
  deviceInfo: {
    deviceName: string;
    deviceType: string;
    osVersion: string;
    appVersion: string;
  };
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface BiometricApprovalRequest {
  id: string;
  userId: string;
  requestingDeviceId: string;
  approvingDeviceId?: string;
  requestType: 'login' | 'file_transfer' | 'remote_control' | 'sensitive_operation';
  requestContext: Record<string, any>;
  approvalStatus: 'pending' | 'approved' | 'denied' | 'expired';
  requestedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
  biometricVerified?: boolean;
}

export interface BiometricApprovalResponse {
  approvalId: string;
  approved: boolean;
  biometricVerified: boolean;
}
