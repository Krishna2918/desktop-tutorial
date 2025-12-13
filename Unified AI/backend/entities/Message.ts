import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index
} from 'typeorm';
import { Thread } from './Thread';
import { User } from './User';
import { Attachment } from './Attachment';
import { AIInteraction } from './AIInteraction';
import { EmbeddingRecord } from './EmbeddingRecord';

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM'
}

export enum MessageContentType {
  TEXT = 'TEXT',
  CODE = 'CODE',
  IMAGE = 'IMAGE',
  FILE = 'FILE'
}

@Entity('messages')
@Index(['threadId', 'createdAt'])
@Index('IDX_MESSAGE_CONTENT_FTS', { synchronize: false }) // FTS index created separately
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Thread, thread => thread.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread!: Thread;

  @Column({ type: 'uuid' })
  threadId!: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: Message;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @Column({
    type: 'simple-enum',
    enum: MessageRole
  })
  role!: MessageRole;

  @Column({ type: 'varchar', length: 100, nullable: true })
  providerId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  model?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'simple-enum',
    enum: MessageContentType,
    default: MessageContentType.TEXT
  })
  contentType!: MessageContentType;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  tokenCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn({ nullable: true })
  editedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'datetime', nullable: true })
  deletedAt?: Date;

  // Relationships
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @OneToMany(() => Attachment, attachment => attachment.message)
  attachments!: Attachment[];

  @OneToMany(() => AIInteraction, interaction => interaction.message)
  aiInteractions!: AIInteraction[];

  @OneToMany(() => EmbeddingRecord, embedding => embedding.message)
  embeddings!: EmbeddingRecord[];
}
