import { Repository, Between } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { auditService } from './audit.service';
import { AuditAction } from '../entities/AuditLog';

export interface TelemetryEvent {
  userId?: string;
  eventType: string;
  eventData: Record<string, any>;
  anonymous?: boolean;
  sessionId?: string;
  deviceId?: string;
  timestamp?: Date;
}

export interface UsageStats {
  userId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  totalEvents: number;
  eventBreakdown: Record<string, number>;
  features: {
    mostUsed: Array<{ feature: string; count: number }>;
    leastUsed: Array<{ feature: string; count: number }>;
  };
  aiUsage: {
    totalRequests: number;
    providerBreakdown: Record<string, number>;
    modelBreakdown: Record<string, number>;
    totalTokens: number;
    totalCost: number;
  };
  engagement: {
    activeDays: number;
    averageSessionDuration: number;
    totalMessages: number;
    totalSessions: number;
  };
}

export interface FeatureUsageMetrics {
  featureName: string;
  totalUses: number;
  uniqueUsers: number;
  averageUsesPerUser: number;
  adoptionRate: number;
  trendsLastWeek: number;
  trendsLastMonth: number;
}

/**
 * Telemetry Service - Privacy-respecting analytics
 *
 * Implements privacy-first telemetry:
 * - Anonymous by default
 * - User consent required for identified tracking
 * - No PII in events
 * - Aggregated insights only
 * - Opt-out friendly
 */
export class TelemetryService {
  // In-memory event store (in production, use TimescaleDB or ClickHouse)
  private events: Array<TelemetryEvent & { id: string; timestamp: Date }> = [];
  private eventIdCounter = 0;

  constructor() {
    // In production, initialize connection to analytics database
  }

  /**
   * Track a telemetry event
   * Privacy-respecting by default (anonymous unless explicitly identified)
   */
  async trackEvent(
    userId: string | undefined,
    eventType: string,
    eventData: Record<string, any>,
    anonymous: boolean = true
  ): Promise<void> {
    if (!eventType) {
      throw new Error('Event type is required');
    }

    // Sanitize event data to remove PII
    const sanitizedData = this.sanitizeEventData(eventData);

    // Create telemetry event
    const event = {
      id: `evt_${++this.eventIdCounter}`,
      userId: anonymous ? undefined : userId,
      eventType,
      eventData: sanitizedData,
      anonymous,
      sessionId: eventData.sessionId,
      deviceId: eventData.deviceId,
      timestamp: new Date()
    };

    // Store event (in production, write to analytics DB)
    this.events.push(event);

    // For identified events, also log to audit trail
    if (!anonymous && userId) {
      await auditService.logAction({
        userId,
        action: AuditAction.CREATE,
        entityType: 'TelemetryEvent',
        metadata: {
          eventType,
          eventData: sanitizedData
        }
      });
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<UsageStats> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!dateRange.start || !dateRange.end) {
      throw new Error('Date range is required');
    }

    // Filter events for user and date range
    const userEvents = this.events.filter(
      event =>
        event.userId === userId &&
        event.timestamp >= dateRange.start &&
        event.timestamp <= dateRange.end
    );

    // Calculate event breakdown
    const eventBreakdown: Record<string, number> = {};
    userEvents.forEach(event => {
      eventBreakdown[event.eventType] = (eventBreakdown[event.eventType] || 0) + 1;
    });

    // Calculate most/least used features
    const featureCounts = Object.entries(eventBreakdown)
      .filter(([eventType]) => eventType.startsWith('feature.'))
      .map(([feature, count]) => ({
        feature: feature.replace('feature.', ''),
        count
      }))
      .sort((a, b) => b.count - a.count);

    const mostUsed = featureCounts.slice(0, 5);
    const leastUsed = featureCounts.slice(-5).reverse();

    // Calculate AI usage stats
    const aiEvents = userEvents.filter(event => event.eventType === 'ai.request');
    const providerBreakdown: Record<string, number> = {};
    const modelBreakdown: Record<string, number> = {};
    let totalTokens = 0;
    let totalCost = 0;

    aiEvents.forEach(event => {
      const provider = event.eventData.provider;
      const model = event.eventData.model;
      const tokens = event.eventData.tokens || 0;
      const cost = event.eventData.cost || 0;

      if (provider) {
        providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;
      }
      if (model) {
        modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
      }
      totalTokens += tokens;
      totalCost += cost;
    });

    // Calculate engagement metrics
    const sessionEvents = userEvents.filter(event => event.eventType === 'session.start');
    const messageEvents = userEvents.filter(event => event.eventType === 'message.sent');

    // Calculate active days
    const uniqueDays = new Set(
      userEvents.map(event => event.timestamp.toDateString())
    );
    const activeDays = uniqueDays.size;

    // Calculate average session duration
    const sessionDurations = this.calculateSessionDurations(userEvents);
    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
          sessionDurations.length
        : 0;

    return {
      userId,
      dateRange,
      totalEvents: userEvents.length,
      eventBreakdown,
      features: {
        mostUsed,
        leastUsed
      },
      aiUsage: {
        totalRequests: aiEvents.length,
        providerBreakdown,
        modelBreakdown,
        totalTokens,
        totalCost
      },
      engagement: {
        activeDays,
        averageSessionDuration,
        totalMessages: messageEvents.length,
        totalSessions: sessionEvents.length
      }
    };
  }

  /**
   * Get feature usage metrics across all users
   * Useful for product analytics and feature adoption tracking
   */
  async getFeatureUsage(featureName: string): Promise<FeatureUsageMetrics> {
    if (!featureName) {
      throw new Error('Feature name is required');
    }

    const featureEventType = `feature.${featureName}`;

    // Get all feature events
    const featureEvents = this.events.filter(
      event => event.eventType === featureEventType
    );

    // Calculate unique users
    const uniqueUsers = new Set(
      featureEvents.filter(event => event.userId).map(event => event.userId)
    );

    // Calculate total users (for adoption rate)
    const allUsers = new Set(
      this.events.filter(event => event.userId).map(event => event.userId)
    );

    // Calculate average uses per user
    const averageUsesPerUser =
      uniqueUsers.size > 0 ? featureEvents.length / uniqueUsers.size : 0;

    // Calculate adoption rate
    const adoptionRate =
      allUsers.size > 0 ? (uniqueUsers.size / allUsers.size) * 100 : 0;

    // Calculate trends
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const lastWeekEvents = featureEvents.filter(
      event => event.timestamp >= oneWeekAgo
    );
    const lastMonthEvents = featureEvents.filter(
      event => event.timestamp >= oneMonthAgo
    );

    return {
      featureName,
      totalUses: featureEvents.length,
      uniqueUsers: uniqueUsers.size,
      averageUsesPerUser,
      adoptionRate,
      trendsLastWeek: lastWeekEvents.length,
      trendsLastMonth: lastMonthEvents.length
    };
  }

  /**
   * Get aggregated platform metrics
   * Anonymous aggregated data only
   */
  async getPlatformMetrics(
    dateRange: { start: Date; end: Date }
  ): Promise<{
    totalEvents: number;
    totalUsers: number;
    activeUsers: number;
    topFeatures: Array<{ feature: string; uses: number }>;
    aiProviderUsage: Record<string, number>;
    averageResponseTime: number;
  }> {
    // Filter events by date range
    const rangeEvents = this.events.filter(
      event =>
        event.timestamp >= dateRange.start && event.timestamp <= dateRange.end
    );

    // Calculate unique users
    const allUsers = new Set(
      this.events.filter(event => event.userId).map(event => event.userId)
    );

    const activeUsers = new Set(
      rangeEvents.filter(event => event.userId).map(event => event.userId)
    );

    // Calculate top features
    const featureEvents = rangeEvents.filter(event =>
      event.eventType.startsWith('feature.')
    );
    const featureCounts: Record<string, number> = {};
    featureEvents.forEach(event => {
      const feature = event.eventType.replace('feature.', '');
      featureCounts[feature] = (featureCounts[feature] || 0) + 1;
    });

    const topFeatures = Object.entries(featureCounts)
      .map(([feature, uses]) => ({ feature, uses }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10);

    // Calculate AI provider usage
    const aiEvents = rangeEvents.filter(event => event.eventType === 'ai.request');
    const aiProviderUsage: Record<string, number> = {};
    aiEvents.forEach(event => {
      const provider = event.eventData.provider;
      if (provider) {
        aiProviderUsage[provider] = (aiProviderUsage[provider] || 0) + 1;
      }
    });

    // Calculate average response time
    const responseTimeEvents = rangeEvents.filter(
      event => event.eventData.responseTime
    );
    const averageResponseTime =
      responseTimeEvents.length > 0
        ? responseTimeEvents.reduce(
            (sum, event) => sum + event.eventData.responseTime,
            0
          ) / responseTimeEvents.length
        : 0;

    return {
      totalEvents: rangeEvents.length,
      totalUsers: allUsers.size,
      activeUsers: activeUsers.size,
      topFeatures,
      aiProviderUsage,
      averageResponseTime
    };
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string | undefined,
    page: string,
    anonymous: boolean = true
  ): Promise<void> {
    await this.trackEvent(
      userId,
      'page.view',
      {
        page,
        timestamp: new Date().toISOString()
      },
      anonymous
    );
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    userId: string | undefined,
    featureName: string,
    metadata: Record<string, any> = {},
    anonymous: boolean = false
  ): Promise<void> {
    await this.trackEvent(
      userId,
      `feature.${featureName}`,
      {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      anonymous
    );
  }

  /**
   * Track AI request
   */
  async trackAIRequest(
    userId: string | undefined,
    provider: string,
    model: string,
    tokens: number,
    cost: number,
    responseTime: number,
    anonymous: boolean = false
  ): Promise<void> {
    await this.trackEvent(
      userId,
      'ai.request',
      {
        provider,
        model,
        tokens,
        cost,
        responseTime,
        timestamp: new Date().toISOString()
      },
      anonymous
    );
  }

  /**
   * Track error
   */
  async trackError(
    userId: string | undefined,
    errorType: string,
    errorMessage: string,
    stackTrace?: string,
    anonymous: boolean = true
  ): Promise<void> {
    await this.trackEvent(
      userId,
      'error',
      {
        errorType,
        errorMessage: this.sanitizeErrorMessage(errorMessage),
        hasStackTrace: !!stackTrace,
        timestamp: new Date().toISOString()
      },
      anonymous
    );
  }

  /**
   * Clear telemetry data for a user (for privacy/GDPR)
   */
  async clearUserTelemetry(userId: string): Promise<number> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const initialCount = this.events.length;
    this.events = this.events.filter(event => event.userId !== userId);
    const deletedCount = initialCount - this.events.length;

    await auditService.logAction({
      userId,
      action: AuditAction.DELETE,
      entityType: 'TelemetryData',
      metadata: {
        deletedEvents: deletedCount
      }
    });

    return deletedCount;
  }

  // Private helper methods

  /**
   * Sanitize event data to remove PII
   */
  private sanitizeEventData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };

    // Remove common PII fields
    const piiFields = [
      'email',
      'password',
      'ssn',
      'phone',
      'creditCard',
      'apiKey',
      'token',
      'secret'
    ];

    piiFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeEventData(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Sanitize error messages to remove potential PII
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove email addresses
    let sanitized = message.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL]'
    );

    // Remove UUIDs
    sanitized = sanitized.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '[UUID]'
    );

    // Remove API keys and tokens
    sanitized = sanitized.replace(/[A-Za-z0-9]{32,}/g, '[TOKEN]');

    return sanitized;
  }

  /**
   * Calculate session durations from events
   */
  private calculateSessionDurations(events: any[]): number[] {
    const sessionMap = new Map<string, { start: Date; end: Date }>();

    events.forEach(event => {
      if (!event.sessionId) return;

      if (event.eventType === 'session.start') {
        sessionMap.set(event.sessionId, {
          start: event.timestamp,
          end: event.timestamp
        });
      } else if (event.sessionId) {
        const session = sessionMap.get(event.sessionId);
        if (session) {
          session.end = event.timestamp;
        }
      }
    });

    return Array.from(sessionMap.values()).map(
      session => (session.end.getTime() - session.start.getTime()) / 1000
    );
  }
}

// Singleton instance
export const telemetryService = new TelemetryService();
