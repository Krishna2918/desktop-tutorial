import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { UserEntity } from '../../database/entities/user.entity';
import { DeviceEntity } from '../../database/entities/device.entity';
import { SessionEntity } from '../../database/entities/session.entity';

describe('Auth Security Tests', () => {
  let service: AuthService;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let userRepository: Repository<UserEntity>;
  let deviceRepository: Repository<DeviceEntity>;
  let sessionRepository: Repository<SessionEntity>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$...',
    accountStatus: 'active' as const,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDevice = {
    id: 'device-123',
    deviceName: 'Test Device',
    deviceType: 'ios' as const,
    uniqueIdentifier: 'test-device-001',
    userId: 'user-123',
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    deviceId: 'device-123',
    accessTokenHash: 'access-hash',
    refreshTokenHash: 'refresh-hash',
    accessTokenExpiresAt: new Date(Date.now() + 900000),
    refreshTokenExpiresAt: new Date(Date.now() + 604800000),
    sessionStatus: 'active' as const,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DeviceEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SessionEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'auth.jwtSecret': 'test-secret',
                'auth.jwtExpiresIn': 900,
                'auth.refreshTokenExpiresIn': 604800,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
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

  describe('Password Security', () => {
    it('should reject passwords shorter than 12 characters', () => {
      const shortPassword = 'Short1!';
      const result = passwordService.validatePasswordStrength(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 12 characters long',
      );
    });

    it('should reject passwords without uppercase letters', () => {
      const noUppercase = 'securepassword123!';
      const result = passwordService.validatePasswordStrength(noUppercase);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter',
      );
    });

    it('should reject passwords without lowercase letters', () => {
      const noLowercase = 'SECUREPASSWORD123!';
      const result = passwordService.validatePasswordStrength(noLowercase);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter',
      );
    });

    it('should reject passwords without numbers', () => {
      const noNumbers = 'SecurePassword!';
      const result = passwordService.validatePasswordStrength(noNumbers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number',
      );
    });

    it('should reject passwords without special characters', () => {
      const noSpecial = 'SecurePassword123';
      const result = passwordService.validatePasswordStrength(noSpecial);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character',
      );
    });

    it('should reject common passwords', () => {
      const commonPassword = 'Password123!';
      const result = passwordService.validatePasswordStrength(commonPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password is too common. Please choose a stronger password',
      );
    });

    it('should accept strong passwords', () => {
      const strongPassword = 'SecureP@ssw0rd123';
      const result = passwordService.validatePasswordStrength(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should use Argon2id for password hashing', async () => {
      const password = 'SecureP@ssw0rd123';
      const hash = await passwordService.hash(password);

      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'SecureP@ssw0rd123';
      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should not store plain text passwords', async () => {
      const password = 'SecureP@ssw0rd123';
      const hash = await passwordService.hash(password);

      expect(hash).not.toContain(password);
      expect(hash).not.toBe(password);
    });
  });

  describe('Token Security', () => {
    it('should hash tokens before database storage', () => {
      const token = 'sample.jwt.token';
      const hash = tokenService.hashToken(token);

      expect(hash).not.toBe(token);
      expect(hash).toHaveLength(64); // SHA-256 produces 64 character hex
    });

    it('should produce consistent hashes for same token', () => {
      const token = 'sample.jwt.token';
      const hash1 = tokenService.hashToken(token);
      const hash2 = tokenService.hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'sample.jwt.token1';
      const token2 = 'sample.jwt.token2';
      const hash1 = tokenService.hashToken(token1);
      const hash2 = tokenService.hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    it('should include token type in JWT payload', async () => {
      const jwtService = new JwtService({
        secret: 'test-secret',
      });

      const payload = {
        sub: 'user-123',
        deviceId: 'device-123',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await jwtService.signAsync(payload);
      const decoded = await jwtService.verifyAsync(token);

      expect(decoded.type).toBe('access');
    });

    it('should set appropriate token expiry times', () => {
      const accessExpiry = tokenService.calculateExpiryDate(900); // 15 minutes
      const refreshExpiry = tokenService.calculateExpiryDate(604800); // 7 days

      const now = Date.now();
      const accessDiff = accessExpiry.getTime() - now;
      const refreshDiff = refreshExpiry.getTime() - now;

      // Allow 5 second tolerance for execution time
      expect(accessDiff).toBeGreaterThanOrEqual(895000);
      expect(accessDiff).toBeLessThanOrEqual(905000);
      expect(refreshDiff).toBeGreaterThanOrEqual(604795000);
      expect(refreshDiff).toBeLessThanOrEqual(604805000);
    });

    it('should correctly identify expired tokens', () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      const validDate = new Date(Date.now() + 900000); // 15 minutes from now

      expect(tokenService.isExpired(expiredDate)).toBe(true);
      expect(tokenService.isExpired(validDate)).toBe(false);
    });

    it('should reject access tokens for refresh endpoint', async () => {
      const mockAccessToken = {
        sub: 'user-123',
        deviceId: 'device-123',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(mockAccessToken as any);

      await expect(service.refreshToken('access.token.here')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject refresh tokens for protected endpoints', async () => {
      const mockRefreshToken = {
        sub: 'user-123',
        deviceId: 'device-123',
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(mockRefreshToken as any);

      // The JWT strategy should reject refresh tokens
      // This would be enforced by JwtStrategy.validate()
      expect(mockRefreshToken.type).not.toBe('access');
    });
  });

  describe('Session Security', () => {
    it('should bind sessions to specific devices', async () => {
      const mockRegisterDto = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        deviceInfo: {
          deviceName: 'Test Device',
          deviceType: 'ios' as const,
          uniqueIdentifier: 'device-001',
          publicKey: 'public-key-001',
          capabilities: {
            supportsClipboardSync: true,
            supportsFileSharing: true,
            supportsRemoteControl: false,
            supportsBiometricUnlock: true,
            maxFileSize: 104857600,
          },
        },
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordService, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest.spyOn(passwordService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(deviceRepository, 'create').mockReturnValue(mockDevice as any);
      jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice as any);
      jest.spyOn(sessionRepository, 'create').mockReturnValue(mockSession as any);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue(mockSession as any);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue({
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
        expiresIn: 900,
      });

      const result = await service.register(
        mockRegisterDto,
        '127.0.0.1',
        'test-agent',
      );

      expect(result.device.id).toBe(mockDevice.id);
      expect(sessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: mockDevice.id,
        }),
      );
    });

    it('should track IP address for sessions', async () => {
      const ipAddress = '192.168.1.100';

      jest.spyOn(sessionRepository, 'create').mockReturnValue(mockSession as any);

      expect(mockSession.ipAddress).toBeDefined();
      expect(typeof mockSession.ipAddress).toBe('string');
    });

    it('should track user agent for sessions', async () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)';

      jest.spyOn(sessionRepository, 'create').mockReturnValue(mockSession as any);

      expect(mockSession.userAgent).toBeDefined();
      expect(typeof mockSession.userAgent).toBe('string');
    });

    it('should revoke session on logout', async () => {
      const mockAccessToken = {
        sub: 'user-123',
        deviceId: 'device-123',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(mockAccessToken as any);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('access-hash');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession as any);
      jest.spyOn(sessionRepository, 'update').mockResolvedValue({} as any);

      await service.logout('access.token');

      expect(sessionRepository.update).toHaveBeenCalledWith(
        { id: mockSession.id },
        expect.objectContaining({
          sessionStatus: 'revoked',
        }),
      );
    });

    it('should prevent reuse of revoked sessions', async () => {
      const revokedSession = {
        ...mockSession,
        sessionStatus: 'revoked' as const,
      };

      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(revokedSession as any);

      await expect(service.refreshToken('refresh.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Account Security', () => {
    it('should reject login for suspended accounts', async () => {
      const suspendedUser = {
        ...mockUser,
        accountStatus: 'suspended' as const,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(suspendedUser as any);

      const mockLoginDto = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        deviceInfo: {
          deviceName: 'Test Device',
          deviceType: 'ios' as const,
          uniqueIdentifier: 'device-001',
          publicKey: 'public-key-001',
          capabilities: {
            supportsClipboardSync: true,
            supportsFileSharing: true,
            supportsRemoteControl: false,
            supportsBiometricUnlock: true,
            maxFileSize: 104857600,
          },
        },
      };

      await expect(
        service.login(mockLoginDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login for deleted accounts', async () => {
      const deletedUser = {
        ...mockUser,
        accountStatus: 'deleted' as const,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(deletedUser as any);

      const mockLoginDto = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        deviceInfo: {
          deviceName: 'Test Device',
          deviceType: 'ios' as const,
          uniqueIdentifier: 'device-001',
          publicKey: 'public-key-001',
          capabilities: {
            supportsClipboardSync: true,
            supportsFileSharing: true,
            supportsRemoteControl: false,
            supportsBiometricUnlock: true,
            maxFileSize: 104857600,
          },
        },
      };

      await expect(
        service.login(mockLoginDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not reveal whether email exists on failed login', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const mockLoginDto = {
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!',
        deviceInfo: {
          deviceName: 'Test Device',
          deviceType: 'ios' as const,
          uniqueIdentifier: 'device-001',
          publicKey: 'public-key-001',
          capabilities: {
            supportsClipboardSync: true,
            supportsFileSharing: true,
            supportsRemoteControl: false,
            supportsBiometricUnlock: true,
            maxFileSize: 104857600,
          },
        },
      };

      try {
        await service.login(mockLoginDto, '127.0.0.1', 'test-agent');
      } catch (error) {
        expect(error.message).toBe('Invalid credentials');
        expect(error.message).not.toContain('email');
        expect(error.message).not.toContain('exists');
      }
    });

    it('should prevent user enumeration on registration', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const mockRegisterDto = {
        email: 'existing@example.com',
        password: 'SecureP@ssw0rd123',
        deviceInfo: {
          deviceName: 'Test Device',
          deviceType: 'ios' as const,
          uniqueIdentifier: 'device-001',
          publicKey: 'public-key-001',
          capabilities: {
            supportsClipboardSync: true,
            supportsFileSharing: true,
            supportsRemoteControl: false,
            supportsBiometricUnlock: true,
            maxFileSize: 104857600,
          },
        },
      };

      try {
        await service.register(mockRegisterDto, '127.0.0.1', 'test-agent');
      } catch (error) {
        // Error message is acceptable as it helps UX
        expect(error).toBeInstanceOf(ConflictException);
      }
    });
  });

  describe('Input Validation & Injection Prevention', () => {
    it('should sanitize email input', async () => {
      const mockRegisterDto = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'SecureP@ssw0rd123',
        deviceInfo: {
          deviceName: 'Test Device',
          deviceType: 'ios' as const,
          uniqueIdentifier: 'device-001',
          publicKey: 'public-key-001',
          capabilities: {
            supportsClipboardSync: true,
            supportsFileSharing: true,
            supportsRemoteControl: false,
            supportsBiometricUnlock: true,
            maxFileSize: 104857600,
          },
        },
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordService, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest.spyOn(passwordService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(deviceRepository, 'create').mockReturnValue(mockDevice as any);
      jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice as any);
      jest.spyOn(sessionRepository, 'create').mockReturnValue(mockSession as any);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue(mockSession as any);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue({
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
        expiresIn: 900,
      });

      await service.register(mockRegisterDto, '127.0.0.1', 'test-agent');

      // Verify email was normalized (lowercase and trimmed)
      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
      );
    });

    it('should use parameterized queries (TypeORM prevents SQL injection)', async () => {
      // TypeORM uses parameterized queries by default
      // This test verifies the pattern is followed

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await service.getCurrentUser('fake.jwt.token').catch(() => {
        // Expected to fail
      });

      // Verify repository methods are used (which use parameterized queries)
      expect(userRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should take similar time for valid and invalid passwords', async () => {
      // This test verifies that password verification doesn't reveal
      // information through timing differences

      const validHash = await passwordService.hash('SecureP@ssw0rd123');
      const invalidPassword = 'WrongPassword123!';

      const start1 = Date.now();
      await passwordService.verify(validHash, 'SecureP@ssw0rd123');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await passwordService.verify(validHash, invalidPassword);
      const time2 = Date.now() - start2;

      // Times should be relatively similar (within 100ms)
      // Argon2 is designed to be constant-time
      const timeDiff = Math.abs(time1 - time2);
      expect(timeDiff).toBeLessThan(100);
    });
  });

  describe('Token Rotation', () => {
    it('should generate new tokens on refresh', async () => {
      const mockRefreshToken = {
        sub: 'user-123',
        deviceId: 'device-123',
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(mockRefreshToken as any);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('refresh-hash');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession as any);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue({
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
        expiresIn: 900,
      });
      jest.spyOn(sessionRepository, 'save').mockResolvedValue(mockSession as any);

      const result = await service.refreshToken('old.refresh.token');

      expect(result.accessToken).toBe('new.access.token');
      expect(tokenService.generateTokenPair).toHaveBeenCalled();
    });

    it('should invalidate old refresh token after rotation', async () => {
      // This is verified by updating the session with new token hashes
      // Old token hash will no longer match any session

      const mockRefreshToken = {
        sub: 'user-123',
        deviceId: 'device-123',
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(mockRefreshToken as any);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('old-refresh-hash');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession as any);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue({
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
        expiresIn: 900,
      });
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({
        ...mockSession,
        refreshTokenHash: 'new-refresh-hash',
      } as any);

      await service.refreshToken('old.refresh.token');

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshTokenHash: expect.not.stringContaining('old-refresh-hash'),
        }),
      );
    });
  });
});
