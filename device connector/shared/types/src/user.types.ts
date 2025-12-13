/**
 * User-related types
 */

export type AccountStatus = 'active' | 'suspended' | 'deleted';
export type OAuthProvider = 'google' | 'apple';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash?: string;
  displayName?: string;
  avatarUrl?: string;
  oauthProvider?: OAuthProvider;
  oauthSubject?: string;
  accountStatus: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata: Record<string, any>;
}

export interface CreateUserDto {
  email: string;
  password?: string;
  displayName?: string;
  oauthProvider?: OAuthProvider;
  oauthSubject?: string;
}

export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
}
