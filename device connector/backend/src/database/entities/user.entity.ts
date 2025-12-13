import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { DeviceEntity } from './device.entity';
import { SessionEntity } from './session.entity';

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export enum OAuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  @Index()
  email: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true, length: 255 })
  passwordHash?: string;

  @Column({ nullable: true, length: 100 })
  displayName?: string;

  @Column({ nullable: true, type: 'text' })
  avatarUrl?: string;

  @Column({
    type: 'enum',
    enum: OAuthProvider,
    nullable: true,
  })
  oauthProvider?: OAuthProvider;

  @Column({ nullable: true, length: 255 })
  @Index()
  oauthSubject?: string;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  accountStatus: AccountStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Relations
  @OneToMany(() => DeviceEntity, (device) => device.user)
  devices: DeviceEntity[];

  @OneToMany(() => SessionEntity, (session) => session.user)
  sessions: SessionEntity[];
}
