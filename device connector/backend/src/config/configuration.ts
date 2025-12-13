export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appVersion: process.env.APP_VERSION || '0.1.0',
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_DATABASE || 'udc_dev',
    username: process.env.DB_USERNAME || 'udc_user',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    },
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'udc:',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'udc-files-dev',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    useSSL: process.env.S3_USE_SSL === 'true',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jwtExpiresIn: parseInt(process.env.JWT_EXPIRES_IN, 10) || 900,
    refreshTokenExpiresIn: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN, 10) || 604800,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID,
        teamId: process.env.APPLE_TEAM_ID,
        keyId: process.env.APPLE_KEY_ID,
        privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH,
        callbackUrl: process.env.APPLE_CALLBACK_URL,
      },
    },
  },

  vault: {
    enabled: process.env.VAULT_ENABLED === 'true',
    addr: process.env.VAULT_ADDR || 'http://localhost:8200',
    token: process.env.VAULT_TOKEN,
  },

  fileUpload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 * 1024,
    allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || ['*'],
    chunkSize: parseInt(process.env.CHUNK_SIZE, 10) || 1024 * 1024,
    virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
  },

  remoteControl: {
    maxSessionDuration: parseInt(process.env.MAX_SESSION_DURATION, 10) || 1800,
    stunServers: process.env.STUN_SERVERS?.split(',') || [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ],
    turnServerUrl: process.env.TURN_SERVER_URL,
    turnServerUsername: process.env.TURN_SERVER_USERNAME,
    turnServerCredential: process.env.TURN_SERVER_CREDENTIAL,
  },

  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    destination: process.env.LOG_DESTINATION || 'console',
  },

  observability: {
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: parseInt(process.env.PROMETHEUS_PORT, 10) || 9090,
      path: process.env.PROMETHEUS_PATH || '/metrics',
    },
    jaeger: {
      enabled: process.env.JAEGER_ENABLED === 'true',
      host: process.env.JAEGER_HOST || 'localhost',
      port: parseInt(process.env.JAEGER_PORT, 10) || 6831,
    },
  },

  cors: {
    enabled: process.env.CORS_ENABLED === 'true',
    origins: process.env.CORS_ORIGINS || '*',
  },

  security: {
    helmetEnabled: process.env.HELMET_ENABLED === 'true',
    compressionEnabled: process.env.COMPRESSION_ENABLED === 'true',
    trustedProxies: process.env.TRUSTED_PROXIES?.split(',') || [],
  },

  websocket: {
    port: parseInt(process.env.WS_PORT, 10) || 3001,
    path: process.env.WS_PATH || '/ws',
    corsOrigins: process.env.WS_CORS_ORIGINS?.split(',') || ['*'],
  },
});
