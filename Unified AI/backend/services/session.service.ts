import { Repository, LessThan } from 'typeorm';
import { Session } from '../entities/Session';
import { Device } from '../entities/Device';
import { User } from '../entities/User';
import { AppDataSource } from '../config/data-source';

export interface CreateSessionInput {
  userId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  createdAt: Date;
  lastActivityAt?: Date;
  expiresAt: Date;
}

export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  revokedSessions: number;
  deviceBreakdown: {
    deviceType: string;
    count: number;
  }[];
}

export class SessionService {
  private sessionRepository: Repository<Session>;
  private deviceRepository: Repository<Device>;
  private userRepository: Repository<User>;

  constructor() {
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.deviceRepository = AppDataSource.getRepository(Device);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<Session> {
    const {
      userId,
      deviceId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt
    } = input;

    // Validate input
    if (!userId || !accessToken || !refreshToken || !expiresAt) {
      throw new Error('Missing required session fields');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // If deviceId provided, verify it exists and belongs to user
    if (deviceId) {
      const device = await this.deviceRepository.findOne({
        where: { id: deviceId, userId }
      });

      if (!device) {
        throw new Error('Device not found or does not belong to user');
      }

      // Update device last sync time
      device.lastSyncAt = new Date();
      await this.deviceRepository.save(device);
    }

    // Create session
    const session = this.sessionRepository.create({
      userId,
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

    return session;
  }

  /**
   * Get active session for a user on a specific device
   */
  async getActiveSession(userId: string, deviceId?: string): Promise<Session | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const query: any = {
      userId,
      isActive: true
    };

    if (deviceId) {
      query.deviceId = deviceId;
    }

    const session = await this.sessionRepository.findOne({
      where: query,
      order: {
        lastActivityAt: 'DESC'
      },
      relations: ['device']
    });

    return session;
  }

  /**
   * Get all sessions for a user
   */
  async getAllUserSessions(userId: string, includeInactive: boolean = false): Promise<SessionInfo[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const query: any = { userId };

    if (!includeInactive) {
      query.isActive = true;
    }

    const sessions = await this.sessionRepository.find({
      where: query,
      order: {
        lastActivityAt: 'DESC'
      },
      relations: ['device']
    });

    return sessions.map(session => this.toSessionInfo(session));
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<Session | null> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['device', 'user']
    });

    return session;
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const session = await this.sessionRepository.findOne({
      where: { refreshToken, isActive: true },
      relations: ['device', 'user']
    });

    return session;
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId: string, reason?: string): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    session.isActive = false;
    session.revokedAt = new Date();
    session.revokedReason = reason || 'Manual revocation';

    await this.sessionRepository.save(session);
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string, reason?: string, exceptSessionId?: string): Promise<number> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const query: any = {
      userId,
      isActive: true
    };

    const sessions = await this.sessionRepository.find({
      where: query
    });

    const sessionsToInvalidate = exceptSessionId
      ? sessions.filter(s => s.id !== exceptSessionId)
      : sessions;

    for (const session of sessionsToInvalidate) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = reason || 'Invalidate all sessions';
    }

    await this.sessionRepository.save(sessionsToInvalidate);

    return sessionsToInvalidate.length;
  }

  /**
   * Invalidate all sessions for a device
   */
  async invalidateDeviceSessions(userId: string, deviceId: string, reason?: string): Promise<number> {
    if (!userId || !deviceId) {
      throw new Error('User ID and Device ID are required');
    }

    const sessions = await this.sessionRepository.find({
      where: {
        userId,
        deviceId,
        isActive: true
      }
    });

    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = reason || 'Device sessions invalidated';
    }

    await this.sessionRepository.save(sessions);

    return sessions.length;
  }

  /**
   * Update last activity time for a session
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, isActive: true }
    });

    if (!session) {
      throw new Error('Active session not found');
    }

    session.lastActivityAt = new Date();

    await this.sessionRepository.save(session);
  }

  /**
   * Update session tokens (when access token is refreshed)
   */
  async updateSessionTokens(sessionId: string, accessToken: string, refreshToken?: string): Promise<void> {
    if (!sessionId || !accessToken) {
      throw new Error('Session ID and access token are required');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, isActive: true }
    });

    if (!session) {
      throw new Error('Active session not found');
    }

    session.accessToken = accessToken;
    if (refreshToken) {
      session.refreshToken = refreshToken;
    }
    session.lastActivityAt = new Date();

    await this.sessionRepository.save(session);
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const expiredSessions = await this.sessionRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
        isActive: true
      }
    });

    for (const session of expiredSessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'Session expired';
    }

    await this.sessionRepository.save(expiredSessions);

    return expiredSessions.length;
  }

  /**
   * Delete old inactive sessions (cleanup)
   */
  async deleteOldInactiveSessions(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('isActive = :isActive', { isActive: false })
      .andWhere('revokedAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Get session statistics for a user
   */
  async getUserSessionStatistics(userId: string): Promise<SessionStatistics> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const allSessions = await this.sessionRepository.find({
      where: { userId },
      relations: ['device']
    });

    const now = new Date();
    const activeSessions = allSessions.filter(s => s.isActive && s.expiresAt > now);
    const expiredSessions = allSessions.filter(s => !s.isActive && s.expiresAt <= now);
    const revokedSessions = allSessions.filter(s => !s.isActive && s.revokedAt);

    // Device breakdown
    const deviceCounts = new Map<string, number>();
    for (const session of activeSessions) {
      if (session.device) {
        const type = session.device.deviceType;
        deviceCounts.set(type, (deviceCounts.get(type) || 0) + 1);
      } else {
        deviceCounts.set('UNKNOWN', (deviceCounts.get('UNKNOWN') || 0) + 1);
      }
    }

    const deviceBreakdown = Array.from(deviceCounts.entries()).map(([deviceType, count]) => ({
      deviceType,
      count
    }));

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      expiredSessions: expiredSessions.length,
      revokedSessions: revokedSessions.length,
      deviceBreakdown
    };
  }

  /**
   * Check if session is valid and active
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, isActive: true }
    });

    if (!session) {
      return false;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      // Auto-invalidate expired session
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'Session expired';
      await this.sessionRepository.save(session);
      return false;
    }

    return true;
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, additionalDays: number = 7): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, isActive: true }
    });

    if (!session) {
      throw new Error('Active session not found');
    }

    const newExpiresAt = new Date(session.expiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);

    session.expiresAt = newExpiresAt;
    session.lastActivityAt = new Date();

    await this.sessionRepository.save(session);
  }

  /**
   * Get sessions by IP address (for security monitoring)
   */
  async getSessionsByIpAddress(ipAddress: string): Promise<SessionInfo[]> {
    if (!ipAddress) {
      throw new Error('IP address is required');
    }

    const sessions = await this.sessionRepository.find({
      where: { ipAddress, isActive: true },
      relations: ['device', 'user']
    });

    return sessions.map(session => this.toSessionInfo(session));
  }

  /**
   * Count active sessions for a user
   */
  async countActiveSessions(userId: string): Promise<number> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const count = await this.sessionRepository.count({
      where: {
        userId,
        isActive: true
      }
    });

    return count;
  }

  // Helper methods

  /**
   * Convert Session entity to SessionInfo
   */
  private toSessionInfo(session: Session): SessionInfo {
    return {
      id: session.id,
      userId: session.userId,
      deviceId: session.deviceId,
      deviceName: session.device?.deviceName,
      deviceType: session.device?.deviceType,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt
    };
  }
}

// Singleton instance
export const sessionService = new SessionService();
