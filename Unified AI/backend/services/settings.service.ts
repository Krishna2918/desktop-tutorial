import { Repository } from 'typeorm';
import { UserSettings } from '../entities/UserSettings';
import { AppDataSource } from '../config/data-source';
import { auditService } from './audit.service';
import { AuditAction } from '../entities/AuditLog';

export type SettingsCategory = 'theme' | 'ai' | 'privacy' | 'notifications' | 'general' | 'accessibility';

export interface UserSettingsInput {
  category: SettingsCategory;
  key: string;
  value: any;
}

export interface SettingsDefaults {
  theme: {
    mode: 'light' | 'dark' | 'high-contrast' | 'auto';
    fontSize: number;
    fontFamily: string;
    colorScheme: string;
    compactMode: boolean;
  };
  ai: {
    defaultProvider: string;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    streamResponses: boolean;
    autoSaveConversations: boolean;
  };
  privacy: {
    telemetryEnabled: boolean;
    crashReportsEnabled: boolean;
    shareUsageData: boolean;
    allowCrossProviderContext: boolean;
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    email: boolean;
    emailFrequency: 'realtime' | 'daily' | 'weekly' | 'never';
  };
  general: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  accessibility: {
    reduceMotion: boolean;
    highContrast: boolean;
    screenReaderOptimized: boolean;
    keyboardNavigation: boolean;
    focusIndicators: boolean;
  };
}

/**
 * Settings Service - User preferences management
 *
 * Manages user settings across categories:
 * - Theme and appearance
 * - AI provider preferences
 * - Privacy controls
 * - Notification preferences
 * - General settings
 * - Accessibility options
 */
export class SettingsService {
  private userSettingsRepository: Repository<UserSettings>;

  // Default settings for new users
  private readonly defaults: SettingsDefaults = {
    theme: {
      mode: 'auto',
      fontSize: 16,
      fontFamily: 'system',
      colorScheme: 'default',
      compactMode: false
    },
    ai: {
      defaultProvider: 'openai',
      defaultModel: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2048,
      streamResponses: true,
      autoSaveConversations: true
    },
    privacy: {
      telemetryEnabled: true,
      crashReportsEnabled: true,
      shareUsageData: false,
      allowCrossProviderContext: false
    },
    notifications: {
      enabled: true,
      sound: true,
      desktop: true,
      email: true,
      emailFrequency: 'daily'
    },
    general: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h'
    },
    accessibility: {
      reduceMotion: false,
      highContrast: false,
      screenReaderOptimized: false,
      keyboardNavigation: true,
      focusIndicators: true
    }
  };

  constructor() {
    this.userSettingsRepository = AppDataSource.getRepository(UserSettings);
  }

  /**
   * Get all user settings, optionally filtered by category
   */
  async getUserSettings(
    userId: string,
    category?: SettingsCategory
  ): Promise<Record<string, any>> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Build query
    const where: any = { userId };
    if (category) {
      where.category = category;
    }

    // Get settings from database
    const settings = await this.userSettingsRepository.find({
      where,
      order: { category: 'ASC', key: 'ASC' }
    });

    // Group settings by category
    const grouped: Record<string, Record<string, any>> = {};
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {};
      }
      grouped[setting.category][setting.key] = setting.value;
    });

    // Merge with defaults
    const result: Record<string, any> = {};
    const categories = category ? [category] : Object.keys(this.defaults);

    categories.forEach(cat => {
      const categoryDefaults = this.defaults[cat as SettingsCategory];
      const categorySettings = grouped[cat] || {};
      result[cat] = { ...categoryDefaults, ...categorySettings };
    });

    return category ? result[category] : result;
  }

  /**
   * Update a single user setting
   */
  async updateUserSettings(
    userId: string,
    category: SettingsCategory,
    key: string,
    value: any
  ): Promise<UserSettings> {
    if (!userId || !category || !key) {
      throw new Error('User ID, category, and key are required');
    }

    // Validate category
    if (!this.isValidCategory(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    // Validate setting key exists in defaults
    if (!this.isValidSettingKey(category, key)) {
      throw new Error(`Invalid setting key: ${key} for category: ${category}`);
    }

    // Validate value type matches default
    const defaultValue = (this.defaults[category] as any)[key];
    if (!this.isValidValueType(value, defaultValue)) {
      throw new Error(
        `Invalid value type for ${category}.${key}. Expected ${typeof defaultValue}, got ${typeof value}`
      );
    }

    // Find or create setting
    let setting = await this.userSettingsRepository.findOne({
      where: { userId, category, key }
    });

    if (setting) {
      setting.value = value;
    } else {
      setting = this.userSettingsRepository.create({
        userId,
        category,
        key,
        value
      });
    }

    const savedSetting = await this.userSettingsRepository.save(setting);

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'UserSettings',
      entityId: savedSetting.id,
      metadata: {
        category,
        key,
        value
      }
    });

    return savedSetting;
  }

  /**
   * Update multiple settings at once
   */
  async updateMultipleSettings(
    userId: string,
    settings: Array<{ category: SettingsCategory; key: string; value: any }>
  ): Promise<UserSettings[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!settings || settings.length === 0) {
      throw new Error('Settings array is required');
    }

    const updatedSettings: UserSettings[] = [];

    for (const setting of settings) {
      const updated = await this.updateUserSettings(
        userId,
        setting.category,
        setting.key,
        setting.value
      );
      updatedSettings.push(updated);
    }

    return updatedSettings;
  }

  /**
   * Reset user settings to defaults
   * Can reset all settings or just a specific category
   */
  async resetToDefaults(
    userId: string,
    category?: SettingsCategory
  ): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Build delete query
    const where: any = { userId };
    if (category) {
      if (!this.isValidCategory(category)) {
        throw new Error(`Invalid category: ${category}`);
      }
      where.category = category;
    }

    // Delete settings (will fall back to defaults)
    const result = await this.userSettingsRepository.delete(where);

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.DELETE,
      entityType: 'UserSettings',
      metadata: {
        category: category || 'all',
        deletedCount: result.affected || 0
      }
    });
  }

  /**
   * Get default settings for a category or all categories
   */
  getDefaultSettings(category?: SettingsCategory): Record<string, any> {
    if (category) {
      if (!this.isValidCategory(category)) {
        throw new Error(`Invalid category: ${category}`);
      }
      return { [category]: this.defaults[category] };
    }

    return this.defaults;
  }

  /**
   * Get a single setting value with fallback to default
   */
  async getSettingValue<T = any>(
    userId: string,
    category: SettingsCategory,
    key: string
  ): Promise<T> {
    if (!userId || !category || !key) {
      throw new Error('User ID, category, and key are required');
    }

    const setting = await this.userSettingsRepository.findOne({
      where: { userId, category, key }
    });

    if (setting) {
      return setting.value as T;
    }

    // Return default value
    const defaultValue = (this.defaults[category] as any)[key];
    if (defaultValue === undefined) {
      throw new Error(`No default value for ${category}.${key}`);
    }

    return defaultValue as T;
  }

  /**
   * Check if a setting has been customized (differs from default)
   */
  async isCustomized(
    userId: string,
    category: SettingsCategory,
    key: string
  ): Promise<boolean> {
    if (!userId || !category || !key) {
      throw new Error('User ID, category, and key are required');
    }

    const setting = await this.userSettingsRepository.findOne({
      where: { userId, category, key }
    });

    return !!setting;
  }

  /**
   * Export user settings
   */
  async exportSettings(userId: string): Promise<{
    userId: string;
    settings: Record<string, Record<string, any>>;
    exportedAt: string;
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const settings = await this.getUserSettings(userId);

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.EXPORT,
      entityType: 'UserSettings',
      metadata: {
        categories: Object.keys(settings)
      }
    });

    return {
      userId,
      settings,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import user settings
   */
  async importSettings(
    userId: string,
    settings: Record<string, Record<string, any>>,
    overwrite: boolean = false
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [category, categorySettings] of Object.entries(settings)) {
      if (!this.isValidCategory(category as SettingsCategory)) {
        errors.push(`Invalid category: ${category}`);
        continue;
      }

      for (const [key, value] of Object.entries(categorySettings)) {
        try {
          // Check if setting already exists
          if (!overwrite) {
            const existing = await this.userSettingsRepository.findOne({
              where: { userId, category, key }
            });
            if (existing) {
              skipped++;
              continue;
            }
          }

          await this.updateUserSettings(
            userId,
            category as SettingsCategory,
            key,
            value
          );
          imported++;
        } catch (error) {
          errors.push(`Error importing ${category}.${key}: ${(error as Error).message}`);
        }
      }
    }

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.CREATE,
      entityType: 'UserSettings',
      metadata: {
        imported,
        skipped,
        errorCount: errors.length,
        overwrite
      }
    });

    return { imported, skipped, errors };
  }

  /**
   * Get settings schema for validation
   */
  getSettingsSchema(): {
    categories: SettingsCategory[];
    schema: Record<string, Record<string, { type: string; default: any }>>;
  } {
    const categories: SettingsCategory[] = Object.keys(this.defaults) as SettingsCategory[];
    const schema: Record<string, Record<string, { type: string; default: any }>> = {};

    categories.forEach(category => {
      schema[category] = {};
      const categoryDefaults = this.defaults[category];

      Object.entries(categoryDefaults).forEach(([key, value]) => {
        schema[category][key] = {
          type: typeof value,
          default: value
        };
      });
    });

    return { categories, schema };
  }

  // Private helper methods

  /**
   * Validate category
   */
  private isValidCategory(category: string): category is SettingsCategory {
    return category in this.defaults;
  }

  /**
   * Validate setting key exists in category
   */
  private isValidSettingKey(category: SettingsCategory, key: string): boolean {
    return key in this.defaults[category];
  }

  /**
   * Validate value type matches expected type
   */
  private isValidValueType(value: any, expectedValue: any): boolean {
    const valueType = typeof value;
    const expectedType = typeof expectedValue;

    // Allow null/undefined for optional values
    if (value === null || value === undefined) {
      return true;
    }

    // Basic type check
    if (valueType !== expectedType) {
      return false;
    }

    // Additional validation for specific types
    if (expectedType === 'number') {
      return !isNaN(value) && isFinite(value);
    }

    return true;
  }
}

// Singleton instance
export const settingsService = new SettingsService();
