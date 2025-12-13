import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { DeviceEntity } from './device.entity';

export enum SessionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

@Entity('sessions')
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid' })
  @Index()
  deviceId: string;

  @Column({ length: 255 })
  @Index()
  accessTokenHash: string;

  @Column({ length: 255 })
  @Index()
  refreshTokenHash: string;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  accessTokenExpiresAt: Date;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  refreshTokenExpiresAt: Date;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  sessionStatus: SessionStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  lastUsedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => DeviceEntity, (device) => device.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deviceId' })
  device: DeviceEntity;
}
