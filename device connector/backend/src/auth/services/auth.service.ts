import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, AccountStatus } from '../../database/entities/user.entity';
import { DeviceEntity, DeviceStatus } from '../../database/entities/device.entity';
import { SessionEntity, SessionStatus } from '../../database/entities/session.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(DeviceEntity)
    private deviceRepository: Repository<DeviceEntity>,
    @InjectRepository(SessionEntity)
    private sessionRepository: Repository<SessionEntity>,
    private passwordService: PasswordService,
    private tokenService: TokenService,
  ) {}

  /**
   * Register a new user with email and password
   * @param registerDto Registration data
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   * @returns Auth response with tokens
   */
  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password, displayName, deviceInfo } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
      });
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(password);

    // Create user
    const user = this.userRepository.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: false,
      metadata: {},
    });

    await this.userRepository.save(user);

    // Register device
    const device = await this.registerDevice(user.id, deviceInfo, ipAddress, userAgent);

    // Generate tokens
    const tokenPair = await this.tokenService.generateTokenPair(user.id, device.id);

    // Create session
    await this.createSession(user.id, device.id, tokenPair, ipAddress, userAgent);

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      device: {
        id: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
      },
    };
  }

  /**
   * Login with email and password
   * @param loginDto Login credentials
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   * @returns Auth response with tokens
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password, deviceInfo } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await this.passwordService.verify(user.passwordHash, password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if device exists, register if not
    let device = await this.deviceRepository.findOne({
      where: {
        userId: user.id,
        uniqueIdentifier: deviceInfo.uniqueIdentifier,
      },
    });

    if (!device) {
      device = await this.registerDevice(user.id, deviceInfo, ipAddress, userAgent);
    } else {
      // Update device info
      device.lastSeenAt = new Date();
      device.ipAddress = ipAddress;
      device.userAgent = userAgent;
      await this.deviceRepository.save(device);
    }

    // Generate tokens
    const tokenPair = await this.tokenService.generateTokenPair(user.id, device.id);

    // Create session
    await this.createSession(user.id, device.id, tokenPair, ipAddress, userAgent);

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      device: {
        id: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Refresh token
   * @returns New token pair
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    // Verify refresh token
    let payload;
    try {
      payload = await this.tokenService.verifyToken(refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Hash token and find session
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const session = await this.sessionRepository.findOne({
      where: {
        refreshTokenHash: tokenHash,
        sessionStatus: SessionStatus.ACTIVE,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found or expired');
    }

    // Check if refresh token is expired
    if (this.tokenService.isExpired(session.refreshTokenExpiresAt)) {
      session.sessionStatus = SessionStatus.EXPIRED;
      await this.sessionRepository.save(session);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new token pair
    const newTokenPair = await this.tokenService.generateTokenPair(
      session.userId,
      session.deviceId,
    );

    // Update session with new tokens (token rotation)
    session.accessTokenHash = this.tokenService.hashToken(newTokenPair.accessToken);
    session.refreshTokenHash = this.tokenService.hashToken(newTokenPair.refreshToken);
    session.accessTokenExpiresAt = this.tokenService.calculateExpiryDate(newTokenPair.expiresIn);
    session.refreshTokenExpiresAt = this.tokenService.calculateExpiryDate(
      604800, // 7 days
    );
    session.lastUsedAt = new Date();

    await this.sessionRepository.save(session);

    return {
      accessToken: newTokenPair.accessToken,
      expiresIn: newTokenPair.expiresIn,
    };
  }

  /**
   * Logout and revoke session
   * @param accessToken Access token
   */
  async logout(accessToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(accessToken);

    const session = await this.sessionRepository.findOne({
      where: {
        accessTokenHash: tokenHash,
      },
    });

    if (session) {
      session.sessionStatus = SessionStatus.REVOKED;
      await this.sessionRepository.save(session);
    }
  }

  /**
   * Get current user from access token
   * @param accessToken Access token
   * @returns User entity
   */
  async getCurrentUser(accessToken: string): Promise<UserEntity> {
    const payload = await this.tokenService.verifyToken(accessToken);

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Register a new device for a user
   * @param userId User ID
   * @param deviceInfo Device information
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   * @returns Device entity
   */
  private async registerDevice(
    userId: string,
    deviceInfo: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DeviceEntity> {
    const device = this.deviceRepository.create({
      userId,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
      deviceModel: deviceInfo.deviceModel,
      uniqueIdentifier: deviceInfo.uniqueIdentifier,
      publicKey: deviceInfo.publicKey,
      capabilities: deviceInfo.capabilities,
      settings: {
        clipboardSyncEnabled: false,
        autoDownloadFiles: true,
        acceptRemoteControl: false,
        notificationPreferences: {
          fileTransfer: true,
          remoteControlRequest: true,
          deviceOnline: false,
        },
        theme: 'dark',
        language: 'en',
      },
      deviceStatus: DeviceStatus.ACTIVE,
      lastSeenAt: new Date(),
      ipAddress,
      userAgent,
    });

    return await this.deviceRepository.save(device);
  }

  /**
   * Create a new session
   * @param userId User ID
   * @param deviceId Device ID
   * @param tokenPair Token pair
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   */
  private async createSession(
    userId: string,
    deviceId: string,
    tokenPair: { accessToken: string; refreshToken: string; expiresIn: number },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const session = this.sessionRepository.create({
      userId,
      deviceId,
      accessTokenHash: this.tokenService.hashToken(tokenPair.accessToken),
      refreshTokenHash: this.tokenService.hashToken(tokenPair.refreshToken),
      accessTokenExpiresAt: this.tokenService.calculateExpiryDate(tokenPair.expiresIn),
      refreshTokenExpiresAt: this.tokenService.calculateExpiryDate(604800), // 7 days
      ipAddress,
      userAgent,
      sessionStatus: SessionStatus.ACTIVE,
    });

    await this.sessionRepository.save(session);
  }
}
