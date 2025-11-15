import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Device } from './Device';

export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  MANUAL = 'MANUAL',
  MERGE = 'MERGE'
}

@Entity('sync_events')
@Index(['deviceId', 'syncedAt'])
@Index(['entityType', 'entityId'])
@Index(['conflictResolved'])
export class SyncEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Device, device => device.syncEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: Device;

  @Column({ type: 'uuid' })
  deviceId!: string;

  @Column({ type: 'varchar', length: 255 })
  entityType!: string;

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({
    type: 'simple-enum',
    enum: SyncOperation
  })
  operation!: SyncOperation;

  @Column({ type: 'simple-json', nullable: true })
  vectorClock?: Record<string, number>;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, any>;

  @CreateDateColumn()
  syncedAt!: Date;

  @Column({ type: 'boolean', default: false })
  conflictResolved!: boolean;

  @Column({
    type: 'simple-enum',
    enum: ConflictResolutionStrategy,
    nullable: true
  })
  conflictResolutionStrategy?: ConflictResolutionStrategy;
}
