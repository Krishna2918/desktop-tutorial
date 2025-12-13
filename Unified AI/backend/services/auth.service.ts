import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { User } from '../entities/User';
import { Session } from '../entities/Session';
import { AppDataSource } from '../config/data-source';
import { jwtUtil } from '../utils/jwt.util';
import { encryptionService } from './encryption.service';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    avatarUrl?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PasswordResetInput {
  token: string;
  newPassword: string;
}

export class AuthService {
  private userRepository: Repository<User>;
  private sessionRepository: Repository<Session>;
  private readonly saltRounds = 12;
  private readonly verificationTokenExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private readonly passwordResetExpiry = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.sessionRepository = AppDataSource.getRepository(Session);
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ user: User; verificationToken: string }> {
    const { email, password, displayName } = input;

    // Validate input
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!displayName || displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Generate email verification token
    const verificationToken = encryptionService.generateToken(32);

    // Create user
    const user = this.userRepository.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName.trim(),
      emailVerified: false,
      emailVerificationToken: verificationToken
    });

    await this.userRepository.save(user);

    return { user, verificationToken };
  }

  /**
   * Verify user's email with token
   */
  async verifyEmail(token: string): Promise<User> {
    if (!token) {
      throw new Error('Verification token is required');
    }

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token }
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    // Update user
    user.emailVerified = true;
    user.emailVerificationToken = undefined;

    await this.userRepository.save(user);

    return user;
  }

  /**
   * Login user and generate tokens
   */
  async login(input: LoginInput, deviceId?: string, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
    const { email, password } = input;

    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is deleted
    if (user.isDeleted) {
      throw new Error('This account has been deleted');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken } = jwtUtil.generateTokenPair(
      user.id,
      user.email,
      user.displayName
    );

    // Calculate expiration (7 days for refresh token)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create session
    const session = this.sessionRepository.create({
      userId: user.id,
      deviceId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
      isActive: true,
      lastActivityAt: new Date()
    });

    await this.sessionRepository.save(session);

    // Update last login time
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl
      },
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  /**
   * Logout user and invalidate session
   */
  async logout(userId: string, deviceId?: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const query: any = { userId, isActive: true };
    if (deviceId) {
      query.deviceId = deviceId;
    }

    const sessions = await this.sessionRepository.find({ where: query });

    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'User logout';
    }

    await this.sessionRepository.save(sessions);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwtUtil.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }

    // Find session
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, isActive: true },
      relations: ['user']
    });

    if (!session) {
      throw new Error('Invalid session');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'Session expired';
      await this.sessionRepository.save(session);
      throw new Error('Session has expired');
    }

    // Generate new access token
    const accessToken = jwtUtil.generateAccessToken(
      session.user.id,
      session.user.email,
      session.user.displayName
    );

    // Update session
    session.accessToken = accessToken;
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return {
      accessToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  /**
   * Request password reset (generates reset token)
   */
  async requestPasswordReset(email: string): Promise<{ resetToken: string; user: User }> {
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // For security, don't reveal if user exists
      // Generate a dummy token to prevent timing attacks
      const dummyToken = encryptionService.generateToken(32);
      throw new Error('If a user with this email exists, a password reset link will be sent');
    }

    if (user.isDeleted) {
      throw new Error('This account has been deleted');
    }

    // Generate reset token
    const resetToken = encryptionService.generateToken(32);

    // Set expiration
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + this.passwordResetExpiry);

    // Update user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = expiresAt;

    await this.userRepository.save(user);

    return { resetToken, user };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(input: PasswordResetInput): Promise<User> {
    const { token, newPassword } = input;

    if (!token) {
      throw new Error('Reset token is required');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Find user with token
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token }
    });

    if (!user) {
      throw new Error('Invalid reset token');
    }

    // Check if token is expired
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new Error('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user
    user.passwordHash = passwordHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await this.userRepository.save(user);

    // Invalidate all existing sessions for security
    await this.sessionRepository.update(
      { userId: user.id, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'Password reset'
      }
    );

    return user;
  }

  /**
   * Validate session with access token
   */
  async validateSession(accessToken: string): Promise<{ user: User; session: Session }> {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwtUtil.verifyAccessToken(accessToken);
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }

    // Find session
    const session = await this.sessionRepository.findOne({
      where: { accessToken, isActive: true },
      relations: ['user']
    });

    if (!session) {
      throw new Error('Invalid session');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'Session expired';
      await this.sessionRepository.save(session);
      throw new Error('Session has expired');
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return { user: session.user, session };
  }

  /**
   * Change user password (requires old password)
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<User> {
    if (!userId || !oldPassword || !newPassword) {
      throw new Error('User ID, old password, and new password are required');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    if (oldPassword === newPassword) {
      throw new Error('New password must be different from old password');
    }

    // Find user
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isPasswordValid = await this.verifyPassword(oldPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid old password');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user
    user.passwordHash = passwordHash;

    await this.userRepository.save(user);

    // Invalidate all other sessions for security (except current one would be handled by middleware)
    await this.sessionRepository.update(
      { userId: user.id, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'Password changed'
      }
    );

    return user;
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ verificationToken: string; user: User }> {
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    // Generate new verification token
    const verificationToken = encryptionService.generateToken(32);

    // Update user
    user.emailVerificationToken = verificationToken;

    await this.userRepository.save(user);

    return { verificationToken, user };
  }

  // Helper methods

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Singleton instance
export const authService = new AuthService();
