import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../src/database/entities/user.entity';
import { DeviceEntity } from '../src/database/entities/device.entity';
import { SessionEntity } from '../src/database/entities/session.entity';

describe('Auth Controller (E2E)', () => {
  let app: INestApplication;
  let userRepository: Repository<UserEntity>;
  let deviceRepository: Repository<DeviceEntity>;
  let sessionRepository: Repository<SessionEntity>;

  const mockRegisterDto = {
    email: 'test@example.com',
    password: 'SecureP@ssw0rd123',
    deviceInfo: {
      deviceName: 'Test iPhone',
      deviceType: 'ios',
      uniqueIdentifier: 'test-device-001',
      publicKey: 'mock-public-key-001',
      capabilities: {
        supportsClipboardSync: true,
        supportsFileSharing: true,
        supportsRemoteControl: false,
        supportsBiometricUnlock: true,
        maxFileSize: 104857600,
      },
    },
  };

  const mockLoginDto = {
    email: 'test@example.com',
    password: 'SecureP@ssw0rd123',
    deviceInfo: {
      deviceName: 'Test iPhone',
      deviceType: 'ios',
      uniqueIdentifier: 'test-device-001',
      publicKey: 'mock-public-key-001',
      capabilities: {
        supportsClipboardSync: true,
        supportsFileSharing: true,
        supportsRemoteControl: false,
        supportsBiometricUnlock: true,
        maxFileSize: 104857600,
      },
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply validation pipes (same as in main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get repositories for cleanup
    userRepository = moduleFixture.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    deviceRepository = moduleFixture.get<Repository<DeviceEntity>>(
      getRepositoryToken(DeviceEntity),
    );
    sessionRepository = moduleFixture.get<Repository<SessionEntity>>(
      getRepositoryToken(SessionEntity),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await sessionRepository.delete({});
    await deviceRepository.delete({});
    await userRepository.delete({});
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('device');
      expect(response.body.device).toHaveProperty('id');
      expect(response.body.device).toHaveProperty('deviceName', 'Test iPhone');

      // Verify user was created in database
      const user = await userRepository.findOne({
        where: { email: 'test@example.com' },
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(user?.passwordHash).toBeDefined();
      expect(user?.accountStatus).toBe('active');
    });

    it('should reject registration with existing email (409)', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto)
        .expect(201);

      // Second registration with same email
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto)
        .expect(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with weak password (400)', async () => {
      const weakPasswordDto = {
        ...mockRegisterDto,
        password: 'weak',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(weakPasswordDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject registration with invalid email (400)', async () => {
      const invalidEmailDto = {
        ...mockRegisterDto,
        email: 'not-an-email',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidEmailDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject registration with missing fields (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto);
    });

    it('should login successfully with correct credentials (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(mockLoginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should reject login with incorrect password (401)', async () => {
      const wrongPasswordDto = {
        ...mockLoginDto,
        password: 'WrongPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(wrongPasswordDto)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email (401)', async () => {
      const nonExistentDto = {
        ...mockLoginDto,
        email: 'nonexistent@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(nonExistentDto)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should create a new session on login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(mockLoginDto)
        .expect(200);

      const sessions = await sessionRepository.find();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('accessTokenHash');
      expect(sessions[0]).toHaveProperty('refreshTokenHash');
      expect(sessions[0]).toHaveProperty('sessionStatus', 'active');
    });

    it('should register new device on first login from new device', async () => {
      const newDeviceDto = {
        ...mockLoginDto,
        deviceInfo: {
          ...mockLoginDto.deviceInfo,
          deviceName: 'Test Android',
          deviceType: 'android',
          uniqueIdentifier: 'test-device-002',
        },
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(newDeviceDto)
        .expect(200);

      const devices = await deviceRepository.find();
      expect(devices.length).toBe(2); // Original device + new device
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and get refresh token
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto);

      refreshToken = response.body.refreshToken;
    });

    it('should refresh access token successfully (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body.accessToken).toBeDefined();
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should reject refresh with invalid token (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject refresh with access token instead of refresh token (401)', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(mockLoginDto);

      const accessToken = loginResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should rotate tokens on refresh (token rotation)', async () => {
      const firstRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const newRefreshToken = firstRefresh.body.refreshToken;
      expect(newRefreshToken).toBeDefined();

      // Old refresh token should no longer work
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      // New refresh token should work
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(200);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and get access token
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto);

      accessToken = response.body.accessToken;
    });

    it('should logout successfully (200)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify session was revoked
      const sessions = await sessionRepository.find({
        where: { sessionStatus: 'active' },
      });
      expect(sessions.length).toBe(0);
    });

    it('should reject logout without token (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });

    it('should reject logout with invalid token (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should prevent using token after logout', async () => {
      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to use the same token
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register and get access token
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto);

      accessToken = response.body.accessToken;
      userId = response.body.user.id;
    });

    it('should return current user profile (200)', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).not.toHaveProperty('passwordHash'); // Should not expose sensitive fields
    });

    it('should reject request without token (401)', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token (401)', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with refresh token (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...mockRegisterDto,
          email: 'test2@example.com',
        });

      const refreshToken = response.body.refreshToken;

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on login endpoint (429)', async () => {
      // Register a user first
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(mockRegisterDto);

      const wrongPasswordDto = {
        ...mockLoginDto,
        password: 'WrongPassword123!',
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(wrongPasswordDto)
          .expect(401);
      }

      // 6th attempt should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(wrongPasswordDto)
        .expect(429);

      expect(response.body).toHaveProperty('message');
    }, 15000); // Increase timeout for this test
  });

  describe('Swagger Documentation', () => {
    it('should serve Swagger API documentation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .expect(200);

      expect(response.text).toContain('Swagger');
    });

    it('should serve OpenAPI JSON spec', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-json')
        .expect(200);

      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('paths');
      expect(response.body.paths).toHaveProperty('/auth/register');
      expect(response.body.paths).toHaveProperty('/auth/login');
    });
  });
});
