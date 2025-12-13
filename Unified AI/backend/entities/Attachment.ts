import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { Message } from './Message';
import { Thread } from './Thread';
import { User } from './User';
import { EmbeddingRecord } from './EmbeddingRecord';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Message, message => message.attachments, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message?: Message;

  @Column({ type: 'uuid', nullable: true })
  messageId?: string;

  @ManyToOne(() => Thread, thread => thread.attachments, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread?: Thread;

  @Column({ type: 'uuid', nullable: true })
  threadId?: string;

  @Column({ type: 'varchar', length: 500 })
  fileName!: string;

  @Column({ type: 'varchar', length: 500 })
  originalFileName!: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType!: string;

  @Column({ type: 'bigint' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 1000 })
  filePath!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  thumbnailPath?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy!: User;

  @Column({ type: 'uuid' })
  uploadedById!: string;

  @CreateDateColumn()
  uploadedAt!: Date;

  @Column({ type: 'boolean', default: false })
  isAnalyzed!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  analysisResult?: Record<string, any>;

  // Relationships
  @OneToMany(() => EmbeddingRecord, embedding => embedding.attachment)
  embeddings!: EmbeddingRecord[];
}
