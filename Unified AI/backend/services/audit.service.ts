import { Repository, Between, In } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppDataSource } from '../config/data-source';

export interface LogActionInput {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
}

export interface AuditLogFilters {
  userId?: string;
  organizationId?: string;
  actions?: AuditAction[];
  entityTypes?: string[];
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogExport {
  logs: Array<{
    timestamp: string;
    userId?: string;
    userName?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }>;
  generatedAt: string;
  organizationId?: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

/**
 * Audit Service - Enterprise audit trail with comprehensive logging
 *
 * Provides complete auditability for compliance and security monitoring:
 * - Action logging for all user operations
 * - Queryable audit log retrieval
 * - Compliance exports (GDPR, SOC2, ISO 27001)
 * - Security event tracking and alerting
 */
export class AuditService {
  private auditLogRepository: Repository<AuditLog>;

  // Security-sensitive actions that require special attention
  private readonly securitySensitiveActions = [
    AuditAction.DELETE,
    AuditAction.EXPORT,
    AuditAction.SHARE,
    AuditAction.LOGIN,
    AuditAction.LOGOUT
  ];

  constructor() {
    this.auditLogRepository = AppDataSource.getRepository(AuditLog);
  }

  /**
   * Log an audit event
   * All user actions should be logged for compliance and security
   */
  async logAction(input: LogActionInput): Promise<AuditLog> {
    const {
      userId,
      action,
      entityType,
      entityId,
      metadata = {},
      ipAddress,
      userAgent,
      organizationId
    } = input;

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    if (!entityType) {
      throw new Error('Entity type is required');
    }

    // Enrich metadata with timestamp and context
    const enrichedMetadata = {
      ...metadata,
      loggedAt: new Date().toISOString(),
      source: 'api'
    };

    // Create audit log entry
    const auditLog = this.auditLogRepository.create({
      userId,
      organizationId,
      action,
      entityType,
      entityId,
      metadata: enrichedMetadata,
      ipAddress,
      userAgent
    });

    const savedLog = await this.auditLogRepository.save(auditLog);

    // Check if this is a security-sensitive action
    if (this.isSecuritySensitive(action)) {
      // In production, this would trigger real-time alerts
      // For now, just add metadata
      await this.flagSecurityEvent(savedLog);
    }

    return savedLog;
  }

  /**
   * Query audit logs with flexible filtering
   */
  async getAuditLog(filters: AuditLogFilters): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      userId,
      organizationId,
      actions,
      entityTypes,
      entityId,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;

    // Build query
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .leftJoinAndSelect('audit.organization', 'organization');

    // Apply filters
    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (organizationId) {
      queryBuilder.andWhere('audit.organizationId = :organizationId', { organizationId });
    }

    if (actions && actions.length > 0) {
      queryBuilder.andWhere('audit.action IN (:...actions)', { actions });
    }

    if (entityTypes && entityTypes.length > 0) {
      queryBuilder.andWhere('audit.entityType IN (:...entityTypes)', { entityTypes });
    }

    if (entityId) {
      queryBuilder.andWhere('audit.entityId = :entityId', { entityId });
    }

    if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    // Order by timestamp descending (most recent first)
    queryBuilder.orderBy('audit.timestamp', 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(offset).take(limit);

    // Execute query
    const logs = await queryBuilder.getMany();

    return {
      logs,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    };
  }

  /**
   * Export audit logs for compliance purposes
   * Supports GDPR, SOC2, ISO 27001, and other compliance frameworks
   */
  async exportAuditLog(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<AuditLogExport | string> {
    if (!organizationId) {
      throw new Error('Organization ID is required for export');
    }

    if (!startDate || !endDate) {
      throw new Error('Start and end dates are required for export');
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    // Retrieve all logs for the organization within date range
    const logs = await this.auditLogRepository.find({
      where: {
        organizationId,
        timestamp: Between(startDate, endDate)
      },
      relations: ['user'],
      order: {
        timestamp: 'ASC'
      }
    });

    // Format logs for export
    const formattedLogs = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      userId: log.userId,
      userName: log.user?.displayName || 'Unknown',
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent
    }));

    if (format === 'csv') {
      return this.convertToCSV(formattedLogs);
    }

    // Return JSON format
    return {
      logs: formattedLogs,
      generatedAt: new Date().toISOString(),
      organizationId,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };
  }

  /**
   * Get security-specific events for monitoring
   */
  async getSecurityEvents(
    userId?: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      severity?: Array<'low' | 'medium' | 'high' | 'critical'>;
      limit?: number;
    }
  ): Promise<SecurityEvent[]> {
    const {
      startDate,
      endDate,
      severity,
      limit = 100
    } = filters || {};

    // Query for security-sensitive actions
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.action IN (:...actions)', {
        actions: this.securitySensitiveActions
      });

    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    queryBuilder
      .orderBy('audit.timestamp', 'DESC')
      .take(limit);

    const logs = await queryBuilder.getMany();

    // Convert to security events with severity classification
    const securityEvents: SecurityEvent[] = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      severity: this.classifySeverity(log),
      description: this.generateSecurityDescription(log)
    }));

    // Filter by severity if specified
    if (severity && severity.length > 0) {
      return securityEvents.filter(event => severity.includes(event.severity));
    }

    return securityEvents;
  }

  /**
   * Get audit statistics for a user or organization
   */
  async getAuditStats(
    filters: {
      userId?: string;
      organizationId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    totalActions: number;
    actionBreakdown: Record<string, number>;
    entityBreakdown: Record<string, number>;
    securityEvents: number;
    timeRange: { start?: string; end?: string };
  }> {
    const { userId, organizationId, startDate, endDate } = filters;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit');

    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (organizationId) {
      queryBuilder.andWhere('audit.organizationId = :organizationId', { organizationId });
    }

    if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    const logs = await queryBuilder.getMany();

    // Calculate statistics
    const actionBreakdown: Record<string, number> = {};
    const entityBreakdown: Record<string, number> = {};
    let securityEvents = 0;

    logs.forEach(log => {
      // Count actions
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;

      // Count entity types
      entityBreakdown[log.entityType] = (entityBreakdown[log.entityType] || 0) + 1;

      // Count security events
      if (this.isSecuritySensitive(log.action)) {
        securityEvents++;
      }
    });

    return {
      totalActions: logs.length,
      actionBreakdown,
      entityBreakdown,
      securityEvents,
      timeRange: {
        start: startDate?.toISOString(),
        end: endDate?.toISOString()
      }
    };
  }

  // Private helper methods

  /**
   * Check if an action is security-sensitive
   */
  private isSecuritySensitive(action: AuditAction): boolean {
    return this.securitySensitiveActions.includes(action);
  }

  /**
   * Flag a security event for monitoring
   */
  private async flagSecurityEvent(log: AuditLog): Promise<void> {
    // In production, this would:
    // 1. Send real-time alerts to security team
    // 2. Log to SIEM system
    // 3. Trigger automated responses if needed
    // For now, we just update metadata

    const metadata = log.metadata || {};
    metadata.securityFlag = true;
    metadata.flaggedAt = new Date().toISOString();

    await this.auditLogRepository.update(log.id, {
      metadata
    });
  }

  /**
   * Classify security event severity
   */
  private classifySeverity(log: AuditLog): 'low' | 'medium' | 'high' | 'critical' {
    switch (log.action) {
      case AuditAction.DELETE:
        return 'high';
      case AuditAction.EXPORT:
        return 'medium';
      case AuditAction.SHARE:
        return 'medium';
      case AuditAction.LOGIN:
        return 'low';
      case AuditAction.LOGOUT:
        return 'low';
      default:
        return 'low';
    }
  }

  /**
   * Generate human-readable security event description
   */
  private generateSecurityDescription(log: AuditLog): string {
    const entityDesc = log.entityId
      ? `${log.entityType} (${log.entityId})`
      : log.entityType;

    switch (log.action) {
      case AuditAction.DELETE:
        return `Deleted ${entityDesc}`;
      case AuditAction.EXPORT:
        return `Exported ${entityDesc}`;
      case AuditAction.SHARE:
        return `Shared ${entityDesc}`;
      case AuditAction.LOGIN:
        return `User logged in`;
      case AuditAction.LOGOUT:
        return `User logged out`;
      default:
        return `${log.action} on ${entityDesc}`;
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return 'No audit logs found';
    }

    // CSV headers
    const headers = [
      'Timestamp',
      'User ID',
      'User Name',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent'
    ];

    // CSV rows
    const rows = logs.map(log => [
      log.timestamp,
      log.userId || '',
      log.userName || '',
      log.action,
      log.entityType,
      log.entityId || '',
      log.ipAddress || '',
      log.userAgent || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }
}

// Singleton instance
export const auditService = new AuditService();
