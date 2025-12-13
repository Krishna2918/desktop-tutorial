import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { SessionEntity } from './session.entity';

export enum DeviceType {
  IOS = 'ios',
  ANDROID = 'android',
  MACOS = 'macos',
  WINDOWS = 'windows',
}

export enum DeviceStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended',
}

export interface DeviceCapabilities {
  biometric: boolean;
  clipboard: boolean;
  files: boolean;
  remoteControl: boolean;
  contacts: boolean;
  screenShare: boolean;
}

export interface DeviceSettings {
  clipboardSyncEnabled: boolean;
  autoDownloadFiles: boolean;
  acceptRemoteControl: boolean;
  notificationPreferences: {
    fileTransfer: boolean;
    remoteControlRequest: boolean;
    deviceOnline: boolean;
  };
  theme: 'dark' | 'light' | 'auto';
  language: string;
}

@Entity('devices')
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ length: 100 })
  deviceName: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
  })
  deviceType: DeviceType;

  @Column({ length: 50 })
  osVersion: string;

  @Column({ length: 50 })
  appVersion: string;

  @Column({ nullable: true, length: 100 })
  deviceModel?: string;

  @Column({ unique: true, length: 255 })
  @Index()
  uniqueIdentifier: string;

  @Column({ type: 'text' })
  publicKey: string;

  @Column({ type: 'jsonb', default: {} })
  capabilities: DeviceCapabilities;

  @Column({ type: 'jsonb', default: {} })
  settings: DeviceSettings;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @Index()
  lastSeenAt?: Date;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.ACTIVE,
  })
  deviceStatus: DeviceStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.devices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @OneToMany(() => SessionEntity, (session) => session.device)
  sessions: SessionEntity[];
}
