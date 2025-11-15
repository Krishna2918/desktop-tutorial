import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from '../src/auth/services/auth.service';
import { PasswordService } from '../src/auth/services/password.service';
import { TokenService } from '../src/auth/services/token.service';
import { UserEntity } from '../src/database/entities/user.entity';
import { DeviceEntity } from '../src/database/entities/device.entity';
import { SessionEntity } from '../src/database/entities/session.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { LoginDto } from '../src/auth/dto/login.dto';

describe('Auth Integration Tests (with Database)', () => {
  let module: TestingModule;
  let authService: AuthService;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let userRepository: Repository<UserEntity>;
  let deviceRepository: Repository<DeviceEntity>;
  let sessionRepository: Repository<SessionEntity>;

  const mockRegisterDto: RegisterDto = {
    email: 'integration@example.com',
    password: 'SecureP@ssw0rd123',
    deviceInfo: {
      deviceName: 'Test Device',
      deviceType: 'ios',
      uniqueIdentifier: 'integration-device-001',
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

  const mockLoginDto: LoginDto = {
    email: 'integration@example.com',
    password: 'SecureP@ssw0rd123',
    deviceInfo: {
      deviceName: 'Test Device',
      deviceType: 'ios',
      uniqueIdentifier: 'integration-device-001',
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
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT, 10) || 5432,
          username: process.env.DB_USERNAME || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_DATABASE || 'udc_test',
          entities: [UserEntity, DeviceEntity, SessionEntity],
          synchronize: true, // Auto-create tables for testing
          dropSchema: true, // Drop schema before each test run
        }),
        TypeOrmModule.forFeature([UserEntity, DeviceEntity, SessionEntity]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [AuthService, PasswordService, TokenService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    passwordService = module.get<PasswordService>(PasswordService);
    tokenService = module.get<TokenService>(TokenService);
    userRepository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    deviceRepository = module.get<Repository<DeviceEntity>>(
      getRepositoryToken(DeviceEntity),
    );
    sessionRepository = module.get<Repository<SessionEntity>>(
      getRepositoryToken(SessionEntity),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await sessionRepository.delete({});
    await deviceRepository.delete({});
    await userRepository.delete({});
  });

  describe('User Registration Flow', () => {
    it('should create user, device, and session in database', async () => {
      const result = await authService.register(
        mockRegisterDto,
        '127.0.0.1',
        'test-agent',
      );

      // Verify result structure
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('device');

      // Verify user in database
      const user = await userRepository.findOne({
        where: { email: 'integration@example.com' },
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe('integration@example.com');
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe(mockRegisterDto.password);

      // Verify device in database
      const device = await deviceRepository.findOne({
        where: { uniqueIdentifier: 'integration-device-001' },
      });
      expect(device).toBeDefined();
      expect(device?.deviceName).toBe('Test Device');
      expect(device?.deviceType).toBe('ios');

      // Verify session in database
      const session = await sessionRepository.findOne({
        where: { userId: user?.id },
      });
      expect(session).toBeDefined();
      expect(session?.sessionStatus).toBe('active');
      expect(session?.accessTokenHash).toBeDefined();
      expect(session?.refreshTokenHash).toBeDefined();
    });

    it('should enforce email uniqueness constraint', async () => {
      // First registration
      await authService.register(mockRegisterDto, '127.0.0.1', 'test-agent');

      // Second registration with same email should fail
      await expect(
        authService.register(mockRegisterDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(ConflictException);

      // Verify only one user exists
      const users = await userRepository.find({
        where: { email: 'integration@example.com' },
      });
      expect(users.length).toBe(1);
    });

    it('should create user-device relationship', async () => {
      const result = await authService.register(
        mockRegisterDto,
        '127.0.0.1',
        'test-agent',
      );

      // Load user with devices
      const user = await userRepository.findOne({
        where: { id: result.user.id },
        relations: ['devices'],
      });

      expect(user?.devices).toBeDefined();
      expect(user?.devices.length).toBe(1);
      expect(user?.devices[0].deviceName).toBe('Test Device');
    });

    it('should hash password using Argon2id', async () => {
      await authService.register(mockRegisterDto, '127.0.0.1', 'test-agent');

      const user = await userRepository.findOne({
        where: { email: 'integration@example.com' },
      });

      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);

      // Verify password can be verified
      const isValid = await passwordService.verify(
        user!.passwordHash!,
        mockRegisterDto.password,
      );
      expect(isValid).toBe(true);
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      // Register a user first
      await authService.register(mockRegisterDto, '127.0.0.1', 'test-agent');
    });

    it('should login and create new session', async () => {
      // Clear existing sessions
      await sessionRepository.delete({});

      const result = await authService.login(
        mockLoginDto,
        '127.0.0.1',
        'test-agent',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');

      // Verify new session was created
      const sessions = await sessionRepository.find();
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionStatus).toBe('active');
    });

    it('should update last login timestamp', async () => {
      const userBefore = await userRepository.findOne({
        where: { email: 'integration@example.com' },
      });
      const lastLoginBefore = userBefore?.lastLoginAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await authService.login(mockLoginDto, '127.0.0.1', 'test-agent');

      const userAfter = await userRepository.findOne({
        where: { email: 'integration@example.com' },
      });
      const lastLoginAfter = userAfter?.lastLoginAt;

      expect(lastLoginAfter).toBeDefined();
      if (lastLoginBefore) {
        expect(lastLoginAfter!.getTime()).toBeGreaterThan(
          lastLoginBefore.getTime(),
        );
      }
    });

    it('should handle login from new device', async () => {
      const newDeviceDto = {
        ...mockLoginDto,
        deviceInfo: {
          ...mockLoginDto.deviceInfo,
          deviceName: 'New iPhone',
          uniqueIdentifier: 'integration-device-002',
        },
      };

      await authService.login(newDeviceDto, '127.0.0.1', 'test-agent');

      // Verify both devices exist
      const devices = await deviceRepository.find();
      expect(devices.length).toBe(2);

      const deviceNames = devices.map((d) => d.deviceName);
      expect(deviceNames).toContain('Test Device');
      expect(deviceNames).toContain('New iPhone');
    });

    it('should reject login with incorrect password', async () => {
      const wrongPasswordDto = {
        ...mockLoginDto,
        password: 'WrongPassword123!',
      };

      await expect(
        authService.login(wrongPasswordDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(UnauthorizedException);

      // Verify no new session was created
      const initialSessionCount = await sessionRepository.count();
      try {
        await authService.login(wrongPasswordDto, '127.0.0.1', 'test-agent');
      } catch (error) {
        // Expected to fail
      }
      const finalSessionCount = await sessionRepository.count();
      expect(finalSessionCount).toBe(initialSessionCount);
    });
  });

  describe('Token Refresh Flow', () => {
    let refreshToken: string;
    let userId: string;
    let deviceId: string;

    beforeEach(async () => {
      const result = await authService.register(
        mockRegisterDto,
        '127.0.0.1',
        'test-agent',
      );
      refreshToken = result.refreshToken;
      userId = result.user.id;
      deviceId = result.device.id;
    });

    it('should update session with new token hashes', async () => {
      const sessionBefore = await sessionRepository.findOne({
        where: { userId },
      });
      const oldAccessTokenHash = sessionBefore?.accessTokenHash;
      const oldRefreshTokenHash = sessionBefore?.refreshTokenHash;

      await authService.refreshToken(refreshToken);

      const sessionAfter = await sessionRepository.findOne({
        where: { userId },
      });

      expect(sessionAfter?.accessTokenHash).toBeDefined();
      expect(sessionAfter?.refreshTokenHash).toBeDefined();
      expect(sessionAfter?.accessTokenHash).not.toBe(oldAccessTokenHash);
      expect(sessionAfter?.refreshTokenHash).not.toBe(oldRefreshTokenHash);
    });

    it('should invalidate old refresh token after rotation', async () => {
      // First refresh
      await authService.refreshToken(refreshToken);

      // Second refresh with old token should fail
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should maintain session continuity', async () => {
      const sessionBefore = await sessionRepository.findOne({
        where: { userId },
      });

      await authService.refreshToken(refreshToken);

      const sessionAfter = await sessionRepository.findOne({
        where: { userId },
      });

      // Should be the same session (same ID)
      expect(sessionAfter?.id).toBe(sessionBefore?.id);
      expect(sessionAfter?.userId).toBe(userId);
      expect(sessionAfter?.deviceId).toBe(deviceId);
    });
  });

  describe('Logout Flow', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register(
        mockRegisterDto,
        '127.0.0.1',
        'test-agent',
      );
      accessToken = result.accessToken;
      userId = result.user.id;
    });

    it('should revoke session in database', async () => {
      await authService.logout(accessToken);

      const session = await sessionRepository.findOne({
        where: { userId },
      });

      expect(session?.sessionStatus).toBe('revoked');
    });

    it('should prevent token reuse after logout', async () => {
      await authService.logout(accessToken);

      await expect(authService.getCurrentUser(accessToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent registrations with different emails', async () => {
      const registrations = [
        authService.register(
          { ...mockRegisterDto, email: 'user1@example.com' },
          '127.0.0.1',
          'test-agent',
        ),
        authService.register(
          { ...mockRegisterDto, email: 'user2@example.com' },
          '127.0.0.1',
          'test-agent',
        ),
        authService.register(
          { ...mockRegisterDto, email: 'user3@example.com' },
          '127.0.0.1',
          'test-agent',
        ),
      ];

      const results = await Promise.all(registrations);

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('user');
      });

      // Verify all users were created
      const users = await userRepository.find();
      expect(users.length).toBe(3);
    });

    it('should handle concurrent login attempts from same user', async () => {
      await authService.register(mockRegisterDto, '127.0.0.1', 'test-agent');

      const logins = [
        authService.login(mockLoginDto, '127.0.0.1', 'test-agent'),
        authService.login(mockLoginDto, '127.0.0.1', 'test-agent'),
        authService.login(mockLoginDto, '127.0.0.1', 'test-agent'),
      ];

      const results = await Promise.all(logins);

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('accessToken');
      });

      // Verify multiple sessions were created
      const sessions = await sessionRepository.find({
        where: { sessionStatus: 'active' },
      });
      expect(sessions.length).toBeGreaterThan(1);
    });
  });

  describe('Database Constraints', () => {
    it('should enforce unique email constraint at database level', async () => {
      const user1 = userRepository.create({
        email: 'test@example.com',
        passwordHash: 'hash1',
        accountStatus: 'active',
        emailVerified: false,
      });
      await userRepository.save(user1);

      const user2 = userRepository.create({
        email: 'test@example.com', // Duplicate email
        passwordHash: 'hash2',
        accountStatus: 'active',
        emailVerified: false,
      });

      // Should throw database constraint violation
      await expect(userRepository.save(user2)).rejects.toThrow();
    });

    it('should cascade delete devices when user is deleted', async () => {
      const result = await authService.register(
        mockRegisterDto,
        '127.0.0.1',
        'test-agent',
      );

      // Delete user
      await userRepository.delete({ id: result.user.id });

      // Verify devices were also deleted (cascade)
      const devices = await deviceRepository.find({
        where: { userId: result.user.id },
      });
      expect(devices.length).toBe(0);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback on registration failure', async () => {
      // This test verifies that if any part of registration fails,
      // no partial data is left in the database

      const invalidDto = {
        ...mockRegisterDto,
        password: 'weak', // Will fail validation
      };

      try {
        await authService.register(invalidDto, '127.0.0.1', 'test-agent');
      } catch (error) {
        // Expected to fail
      }

      // Verify no user was created
      const users = await userRepository.find();
      expect(users.length).toBe(0);

      // Verify no device was created
      const devices = await deviceRepository.find();
      expect(devices.length).toBe(0);

      // Verify no session was created
      const sessions = await sessionRepository.find();
      expect(sessions.length).toBe(0);
    });
  });
});
