import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './User';
import { SyncEvent } from './SyncEvent';

export enum DeviceType {
  DESKTOP = 'DESKTOP',
  WEB = 'WEB',
  MOBILE = 'MOBILE'
}

@Entity('devices')
@Index(['userId', 'isActive'])
@Index(['lastSyncAt'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, user => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  deviceName!: string;

  @Column({
    type: 'simple-enum',
    enum: DeviceType
  })
  deviceType!: DeviceType;

  @Column({ type: 'varchar', length: 100 })
  platform!: string;

  @Column({ type: 'datetime', nullable: true })
  lastSyncAt?: Date;

  @CreateDateColumn()
  registeredAt!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Relationships
  @OneToMany(() => SyncEvent, syncEvent => syncEvent.device)
  syncEvents!: SyncEvent[];
}
