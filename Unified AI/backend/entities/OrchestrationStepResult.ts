import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { OrchestrationFlow } from './OrchestrationFlow';
import { Message } from './Message';

export enum OrchestrationStepStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

@Entity('orchestration_step_results')
@Index(['flowId', 'executedAt'])
export class OrchestrationStepResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OrchestrationFlow, flow => flow.stepResults, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow!: OrchestrationFlow;

  @Column({ type: 'uuid' })
  flowId!: string;

  @Column({ type: 'varchar', length: 255 })
  stepId!: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'messageId' })
  message?: Message;

  @Column({ type: 'uuid', nullable: true })
  messageId?: string;

  @Column({
    type: 'simple-enum',
    enum: OrchestrationStepStatus
  })
  status!: OrchestrationStepStatus;

  @Column({ type: 'text', nullable: true })
  output?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  executedAt!: Date;
}
