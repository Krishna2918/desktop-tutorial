import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { UserEntity, AccountStatus } from '../../database/entities/user.entity';
import { DeviceEntity, DeviceStatus } from '../../database/entities/device.entity';
import { SessionEntity, SessionStatus } from '../../database/entities/session.entity';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<UserEntity>;
  let deviceRepository: Repository<DeviceEntity>;
  let sessionRepository: Repository<SessionEntity>;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  const mockUser: Partial<UserEntity> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$...',
    displayName: 'Test User',
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDevice: Partial<DeviceEntity> = {
    id: '987fcdeb-51a2-43d7-9012-345678901234',
    userId: mockUser.id,
    deviceName: 'iPhone 14 Pro',
    deviceType: 'ios' as any,
    osVersion: '17.2',
    appVersion: '0.1.0',
    uniqueIdentifier: 'unique-device-id',
    publicKey: 'mock-public-key',
    deviceStatus: DeviceStatus.ACTIVE,
    capabilities: {
      biometric: true,
      clipboard: true,
      files: true,
      remoteControl: true,
      contacts: false,
      screenShare: true,
    },
  };

  const mockTokenPair = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    expiresIn: 900,
  };

  const mockRegisterDto: RegisterDto = {
    email: 'newuser@example.com',
    password: 'SecureP@ssw0rd123',
    displayName: 'New User',
    deviceInfo: {
      deviceName: 'iPhone 14 Pro',
      deviceType: 'ios',
      osVersion: '17.2',
      appVersion: '0.1.0',
      uniqueIdentifier: 'unique-device-id',
      publicKey: 'mock-public-key',
      capabilities: {
        biometric: true,
        clipboard: true,
        files: true,
        remoteControl: true,
        contacts: false,
        screenShare: true,
      },
    },
  };

  const mockLoginDto: LoginDto = {
    email: 'test@example.com',
    password: 'SecureP@ssw0rd123',
    deviceInfo: mockRegisterDto.deviceInfo,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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
          },
        },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn(),
            verify: jest.fn(),
            validatePasswordStrength: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokenPair: jest.fn(),
            verifyToken: jest.fn(),
            hashToken: jest.fn(),
            calculateExpiryDate: jest.fn(),
            isExpired: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    deviceRepository = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
    sessionRepository = module.get<Repository<SessionEntity>>(getRepositoryToken(SessionEntity));
    passwordService = module.get<PasswordService>(PasswordService);
    tokenService = module.get<TokenService>(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordService, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest.spyOn(passwordService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as UserEntity);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(deviceRepository, 'create').mockReturnValue(mockDevice as DeviceEntity);
      jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice as DeviceEntity);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue(mockTokenPair);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-token');
      jest.spyOn(tokenService, 'calculateExpiryDate').mockReturnValue(new Date());
      jest.spyOn(sessionRepository, 'create').mockReturnValue({} as SessionEntity);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({} as SessionEntity);

      const result = await service.register(mockRegisterDto, '127.0.0.1', 'test-agent');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockRegisterDto.email.toLowerCase());
      expect(userRepository.save).toHaveBeenCalledTimes(2); // Once for create, once for lastLogin
    });

    it('should throw ConflictException if user already exists', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);

      await expect(
        service.register(mockRegisterDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for weak password', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordService, 'validatePasswordStrength').mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 12 characters long'],
      });

      await expect(
        service.register(mockRegisterDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should convert email to lowercase', async () => {
      const dtoWithUppercaseEmail = { ...mockRegisterDto, email: 'TEST@EXAMPLE.COM' };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordService, 'validatePasswordStrength').mockReturnValue({
        isValid: true,
        errors: [],
      });
      jest.spyOn(passwordService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as UserEntity);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(deviceRepository, 'create').mockReturnValue(mockDevice as DeviceEntity);
      jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice as DeviceEntity);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue(mockTokenPair);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-token');
      jest.spyOn(tokenService, 'calculateExpiryDate').mockReturnValue(new Date());
      jest.spyOn(sessionRepository, 'create').mockReturnValue({} as SessionEntity);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({} as SessionEntity);

      await service.register(dtoWithUppercaseEmail, '127.0.0.1', 'test-agent');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(true);
      jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(mockDevice as DeviceEntity);
      jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice as DeviceEntity);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue(mockTokenPair);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-token');
      jest.spyOn(tokenService, 'calculateExpiryDate').mockReturnValue(new Date());
      jest.spyOn(sessionRepository, 'create').mockReturnValue({} as SessionEntity);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({} as SessionEntity);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as UserEntity);

      const result = await service.login(mockLoginDto, '127.0.0.1', 'test-agent');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.login(mockLoginDto, '127.0.0.1', 'test-agent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(false);

      await expect(service.login(mockLoginDto, '127.0.0.1', 'test-agent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for suspended account', async () => {
      const suspendedUser = { ...mockUser, accountStatus: AccountStatus.SUSPENDED };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(suspendedUser as UserEntity);

      await expect(service.login(mockLoginDto, '127.0.0.1', 'test-agent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should register new device if not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(true);
      jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(deviceRepository, 'create').mockReturnValue(mockDevice as DeviceEntity);
      jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice as DeviceEntity);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue(mockTokenPair);
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-token');
      jest.spyOn(tokenService, 'calculateExpiryDate').mockReturnValue(new Date());
      jest.spyOn(sessionRepository, 'create').mockReturnValue({} as SessionEntity);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({} as SessionEntity);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as UserEntity);

      await service.login(mockLoginDto, '127.0.0.1', 'test-agent');

      expect(deviceRepository.create).toHaveBeenCalled();
      expect(deviceRepository.save).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'mock.refresh.token';
    const mockSession: Partial<SessionEntity> = {
      id: 'session-id',
      userId: mockUser.id,
      deviceId: mockDevice.id,
      refreshTokenHash: 'hashed-refresh-token',
      sessionStatus: SessionStatus.ACTIVE,
      accessTokenExpiresAt: new Date(Date.now() + 900000),
      refreshTokenExpiresAt: new Date(Date.now() + 604800000),
    };

    it('should refresh token successfully', async () => {
      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue({
        sub: mockUser.id,
        deviceId: mockDevice.id,
        type: 'refresh',
      });
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-refresh-token');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession as SessionEntity);
      jest.spyOn(tokenService, 'isExpired').mockReturnValue(false);
      jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue(mockTokenPair);
      jest.spyOn(tokenService, 'calculateExpiryDate').mockReturnValue(new Date());
      jest.spyOn(sessionRepository, 'save').mockResolvedValue(mockSession as SessionEntity);

      const result = await service.refreshToken(mockRefreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
      expect(sessionRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jest.spyOn(tokenService, 'verifyToken').mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for access token instead of refresh', async () => {
      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue({
        sub: mockUser.id,
        deviceId: mockDevice.id,
        type: 'access',
      });

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue({
        sub: mockUser.id,
        deviceId: mockDevice.id,
        type: 'refresh',
      });
      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-refresh-token');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession as SessionEntity);
      jest.spyOn(tokenService, 'isExpired').mockReturnValue(true);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({
        ...mockSession,
        sessionStatus: SessionStatus.EXPIRED,
      } as SessionEntity);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke session on logout', async () => {
      const mockAccessToken = 'mock.access.token';
      const mockSession: Partial<SessionEntity> = {
        id: 'session-id',
        userId: mockUser.id,
        deviceId: mockDevice.id,
        accessTokenHash: 'hashed-access-token',
        sessionStatus: SessionStatus.ACTIVE,
      };

      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-access-token');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession as SessionEntity);
      jest.spyOn(sessionRepository, 'save').mockResolvedValue({
        ...mockSession,
        sessionStatus: SessionStatus.REVOKED,
      } as SessionEntity);

      await service.logout(mockAccessToken);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionStatus: SessionStatus.REVOKED,
        }),
      );
    });

    it('should handle logout for non-existent session', async () => {
      const mockAccessToken = 'mock.access.token';

      jest.spyOn(tokenService, 'hashToken').mockReturnValue('hashed-access-token');
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(null);

      await expect(service.logout(mockAccessToken)).resolves.not.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user from valid token', async () => {
      const mockAccessToken = 'mock.access.token';

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue({
        sub: mockUser.id,
        deviceId: mockDevice.id,
        type: 'access',
      });
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);

      const result = await service.getCurrentUser(mockAccessToken);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const mockAccessToken = 'mock.access.token';

      jest.spyOn(tokenService, 'verifyToken').mockResolvedValue({
        sub: mockUser.id,
        deviceId: mockDevice.id,
        type: 'access',
      });
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getCurrentUser(mockAccessToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
