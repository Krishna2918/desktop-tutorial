import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';
import { Message } from './Message';
import { Attachment } from './Attachment';
import { OrchestrationFlow } from './OrchestrationFlow';

@Entity('threads')
@Index(['projectId', 'createdAt'])
@Index(['createdById'])
export class Thread {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, project => project.threads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'simple-json', default: () => "'[]'" })
  tags!: string[];

  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived!: boolean;

  @ManyToOne(() => User, user => user.createdThreads)
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @Column({ type: 'uuid' })
  createdById!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  lastMessageAt?: Date;

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'simple-json', default: () => "'[]'" })
  participatingProviders!: string[];

  @Column({ type: 'simple-json', nullable: true })
  contextSettings?: Record<string, any>;

  // Relationships
  @OneToMany(() => Message, message => message.thread)
  messages!: Message[];

  @OneToMany(() => Attachment, attachment => attachment.thread)
  attachments!: Attachment[];

  @OneToMany(() => OrchestrationFlow, flow => flow.thread)
  orchestrationFlows!: OrchestrationFlow[];
}
