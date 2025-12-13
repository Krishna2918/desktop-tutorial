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

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
}

export type RequestType = 'login' | 'file_transfer' | 'remote_control' | 'sensitive_operation';

@Entity('biometric_approvals')
export class BiometricApprovalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid' })
  @Index()
  requestingDeviceId: string;

  @Column({ type: 'uuid', nullable: true })
  approvingDeviceId?: string;

  @Column({ length: 50 })
  requestType: RequestType;

  @Column({ type: 'jsonb', default: {} })
  requestContext: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  @Index()
  approvalStatus: ApprovalStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  requestedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  respondedAt?: Date;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  expiresAt: Date;

  @Column({ nullable: true })
  biometricVerified?: boolean;

  // Relations
  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => DeviceEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requestingDeviceId' })
  requestingDevice: DeviceEntity;

  @ManyToOne(() => DeviceEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'approvingDeviceId' })
  approvingDevice?: DeviceEntity;
}
