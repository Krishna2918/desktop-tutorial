import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './User';

@Entity('telemetry_events')
@Index(['userId', 'timestamp'])
@Index(['sessionId', 'timestamp'])
@Index(['eventType', 'timestamp'])
@Index(['isAnonymous', 'timestamp'])
export class TelemetryEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 255 })
  eventType!: string;

  @Column({ type: 'simple-json', nullable: true })
  eventData?: Record<string, any>;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({ type: 'boolean', default: false })
  isAnonymous!: boolean;
}
