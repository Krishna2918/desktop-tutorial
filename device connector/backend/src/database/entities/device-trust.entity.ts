import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { DeviceEntity } from './device.entity';

export enum TrustLevel {
  FULL = 'full',
  LIMITED = 'limited',
  REVOKED = 'revoked',
}

export type DevicePermission = 'file_transfer' | 'clipboard' | 'remote_control' | 'contacts';

@Entity('device_trust')
@Unique(['sourceDeviceId', 'targetDeviceId'])
export class DeviceTrustEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  sourceDeviceId: string;

  @Column({ type: 'uuid' })
  @Index()
  targetDeviceId: string;

  @Column({
    type: 'enum',
    enum: TrustLevel,
    default: TrustLevel.FULL,
  })
  trustLevel: TrustLevel;

  @Column({ type: 'jsonb', default: [] })
  permissions: DevicePermission[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  grantedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt?: Date;

  // Relations
  @ManyToOne(() => DeviceEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sourceDeviceId' })
  sourceDevice: DeviceEntity;

  @ManyToOne(() => DeviceEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'targetDeviceId' })
  targetDevice: DeviceEntity;
}
