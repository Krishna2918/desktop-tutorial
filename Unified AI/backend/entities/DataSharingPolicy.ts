import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './User';

@Entity('data_sharing_policies')
@Index(['userId', 'providerKey'], { unique: true })
export class DataSharingPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  providerKey!: string;

  @Column({ type: 'boolean', default: true })
  allowConversationHistory!: boolean;

  @Column({ type: 'boolean', default: true })
  allowAttachments!: boolean;

  @Column({ type: 'boolean', default: false })
  allowCrossProviderContext!: boolean;

  @Column({ type: 'int', nullable: true })
  retentionDays?: number;

  @Column({ type: 'simple-json', nullable: true })
  settings?: Record<string, any>;

  @UpdateDateColumn()
  updatedAt!: Date;
}
