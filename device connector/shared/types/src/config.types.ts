/**
 * Configuration types
 */

export type Environment = 'development' | 'staging' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  environment: Environment;
  version: string;
  apiUrl: string;
  wsUrl: string;
  logLevel: LogLevel;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  useSSL: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: number;
  refreshTokenExpiresIn: number;
  bcryptRounds: number;
  oauth: {
    google?: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
    apple?: {
      clientId: string;
      teamId: string;
      keyId: string;
      privateKey: string;
      callbackUrl: string;
    };
  };
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  chunkSize: number;
  virusScanEnabled: boolean;
}

export interface RemoteControlConfig {
  maxSessionDuration: number;
  iceServers: RTCIceServer[];
  codecPreferences: string[];
}

export interface ObservabilityConfig {
  prometheus: {
    enabled: boolean;
    port: number;
    path: string;
  };
  jaeger: {
    enabled: boolean;
    host: string;
    port: number;
  };
  logging: {
    level: LogLevel;
    format: 'json' | 'pretty';
    destination: 'console' | 'file' | 'both';
  };
}
