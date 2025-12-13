import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Message } from './Message';
import { AIProviderConfig } from './AIProviderConfig';

export enum AIInteractionStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED'
}

@Entity('ai_interactions')
@Index(['messageId', 'createdAt'])
@Index(['providerConfigId', 'createdAt'])
@Index(['status', 'createdAt'])
export class AIInteraction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Message, message => message.aiInteractions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Message;

  @Column({ type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => AIProviderConfig, config => config.interactions)
  @JoinColumn({ name: 'providerConfigId' })
  providerConfig!: AIProviderConfig;

  @Column({ type: 'uuid' })
  providerConfigId!: string;

  @Column({ type: 'varchar', length: 255 })
  model!: string;

  @Column({ type: 'int', default: 0 })
  promptTokens!: number;

  @Column({ type: 'int', default: 0 })
  completionTokens!: number;

  @Column({ type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ type: 'int', default: 0 })
  latencyMs!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  cost!: number;

  @Column({
    type: 'simple-enum',
    enum: AIInteractionStatus
  })
  status!: AIInteractionStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'simple-json', nullable: true })
  requestPayload?: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  responsePayload?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
