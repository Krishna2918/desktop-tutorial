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
import { Document } from './Document';
import { Attachment } from './Attachment';

export enum EmbeddingSourceType {
  MESSAGE = 'MESSAGE',
  DOCUMENT = 'DOCUMENT',
  ATTACHMENT = 'ATTACHMENT'
}

@Entity('embedding_records')
@Index(['sourceType', 'sourceId'])
@Index(['createdAt'])
export class EmbeddingRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'simple-enum',
    enum: EmbeddingSourceType
  })
  sourceType!: EmbeddingSourceType;

  @Column({ type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'text' })
  content!: string;

  // Store embedding as JSON array for SQLite/PostgreSQL compatibility
  // For production with pgvector, this would be a vector type
  @Column({ type: 'simple-json' })
  embedding!: number[];

  @Column({ type: 'varchar', length: 255 })
  model!: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  // Relationships (optional references)
  @ManyToOne(() => Message, message => message.embeddings, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message?: Message;

  @Column({ type: 'uuid', nullable: true })
  messageId?: string;

  @ManyToOne(() => Document, document => document.embeddings, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document?: Document;

  @Column({ type: 'uuid', nullable: true })
  documentId?: string;

  @ManyToOne(() => Attachment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attachmentId' })
  attachment?: Attachment;

  @Column({ type: 'uuid', nullable: true })
  attachmentId?: string;
}
