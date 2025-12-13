import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../services/token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockDeviceId = '987fcdeb-51a2-43d7-9012-345678901234';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
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

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', async () => {
      const mockAccessToken = 'mock.access.token';
      const mockRefreshToken = 'mock.refresh.token';

      jest.spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      const result = await service.generateTokenPair(mockUserId, mockDeviceId);

      expect(result).toHaveProperty('accessToken', mockAccessToken);
      expect(result).toHaveProperty('refreshToken', mockRefreshToken);
      expect(result).toHaveProperty('expiresIn', 900);
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should sign access token with correct payload', async () => {
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('mock.token');

      await service.generateTokenPair(mockUserId, mockDeviceId);

      const firstCall = (jwtService.signAsync as jest.Mock).mock.calls[0];
      const payload = firstCall[0];

      expect(payload).toHaveProperty('sub', mockUserId);
      expect(payload).toHaveProperty('deviceId', mockDeviceId);
      expect(payload).toHaveProperty('type', 'access');
    });

    it('should sign refresh token with correct payload', async () => {
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('mock.token');

      await service.generateTokenPair(mockUserId, mockDeviceId);

      const secondCall = (jwtService.signAsync as jest.Mock).mock.calls[1];
      const payload = secondCall[0];

      expect(payload).toHaveProperty('sub', mockUserId);
      expect(payload).toHaveProperty('deviceId', mockDeviceId);
      expect(payload).toHaveProperty('type', 'refresh');
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        sub: mockUserId,
        deviceId: mockDeviceId,
        type: 'access' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockPayload);

      const result = await service.verifyToken(mockToken);

      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
        secret: 'test-secret',
      });
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid.token';

      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyToken(invalidToken)).rejects.toThrow('Invalid or expired token');
    });

    it('should throw error for expired token', async () => {
      const expiredToken = 'expired.jwt.token';

      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('Token expired'));

      await expect(service.verifyToken(expiredToken)).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('hashToken', () => {
    it('should hash a token using SHA-256', () => {
      const token = 'sample.jwt.token';
      const hash = service.hashToken(token);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 produces 64 character hex string
      expect(hash).not.toBe(token);
    });

    it('should produce consistent hashes for the same token', () => {
      const token = 'sample.jwt.token';
      const hash1 = service.hashToken(token);
      const hash2 = service.hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'sample.jwt.token1';
      const token2 = 'sample.jwt.token2';

      const hash1 = service.hashToken(token1);
      const hash2 = service.hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRandomToken', () => {
    it('should generate a random token', () => {
      const token = service.generateRandomToken();

      expect(token).toBeDefined();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(typeof token).toBe('string');
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateRandomToken();
      const token2 = service.generateRandomToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of custom length', () => {
      const token = service.generateRandomToken(16);

      expect(token).toHaveLength(32); // 16 bytes = 32 hex characters
    });
  });

  describe('calculateExpiryDate', () => {
    it('should calculate correct expiry date', () => {
      const expiresIn = 900; // 15 minutes
      const now = Date.now();
      const expiryDate = service.calculateExpiryDate(expiresIn);

      const expectedExpiry = new Date(now + expiresIn * 1000);
      const diff = Math.abs(expiryDate.getTime() - expectedExpiry.getTime());

      expect(diff).toBeLessThan(1000); // Less than 1 second difference
    });

    it('should handle different expiry times', () => {
      const shortExpiry = service.calculateExpiryDate(60); // 1 minute
      const longExpiry = service.calculateExpiryDate(86400); // 1 day

      const diff = longExpiry.getTime() - shortExpiry.getTime();
      const expectedDiff = (86400 - 60) * 1000;

      expect(Math.abs(diff - expectedDiff)).toBeLessThan(1000);
    });
  });

  describe('isExpired', () => {
    it('should return true for past date', () => {
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago
      expect(service.isExpired(pastDate)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date(Date.now() + 10000); // 10 seconds from now
      expect(service.isExpired(futureDate)).toBe(false);
    });

    it('should return true for current time', () => {
      const now = new Date();
      // This might be flaky, but current time should be considered expired
      expect(service.isExpired(now)).toBe(true);
    });
  });
});
