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
import { Project } from './Project';
import { User } from './User';
import { EmbeddingRecord } from './EmbeddingRecord';

export enum DocumentContentType {
  MARKDOWN = 'MARKDOWN',
  RICH_TEXT = 'RICH_TEXT',
  CODE = 'CODE'
}

@Entity('documents')
@Index(['projectId', 'createdAt'])
@Index(['createdById', 'createdAt'])
@Index('IDX_DOCUMENT_CONTENT_FTS', { synchronize: false }) // FTS index created separately
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'simple-enum',
    enum: DocumentContentType,
    default: DocumentContentType.MARKDOWN
  })
  contentType!: DocumentContentType;

  @Column({ type: 'simple-json', default: [] })
  tags!: string[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @Column({ type: 'uuid' })
  createdById!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'datetime', nullable: true })
  deletedAt?: Date;

  // Relationships
  @OneToMany(() => EmbeddingRecord, embedding => embedding.document)
  embeddings!: EmbeddingRecord[];
}
