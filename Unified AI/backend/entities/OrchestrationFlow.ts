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
import { Thread } from './Thread';
import { OrchestrationStepResult } from './OrchestrationStepResult';

export enum OrchestrationFlowType {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  CONDITIONAL = 'CONDITIONAL',
  CRITIQUE = 'CRITIQUE',
  REFINEMENT = 'REFINEMENT'
}

export enum OrchestrationFlowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

@Entity('orchestration_flows')
@Index(['threadId', 'createdAt'])
@Index(['status', 'createdAt'])
export class OrchestrationFlow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Thread, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread!: Thread;

  @Column({ type: 'uuid' })
  threadId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'simple-enum',
    enum: OrchestrationFlowType
  })
  flowType!: OrchestrationFlowType;

  @Column({ type: 'simple-json' })
  steps!: Record<string, any>[];

  @Column({ type: 'int', default: 0 })
  currentStepIndex!: number;

  @Column({
    type: 'simple-enum',
    enum: OrchestrationFlowStatus,
    default: OrchestrationFlowStatus.PENDING
  })
  status!: OrchestrationFlowStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'simple-json', nullable: true })
  result?: Record<string, any>;

  // Relationships
  @OneToMany(() => OrchestrationStepResult, stepResult => stepResult.flow)
  stepResults!: OrchestrationStepResult[];
}
