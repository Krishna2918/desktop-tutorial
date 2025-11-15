import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Workspace } from './Workspace';
import { Thread } from './Thread';
import { Document } from './Document';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Workspace, workspace => workspace.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, default: '📝' })
  icon!: string;

  @Column({ type: 'varchar', length: 7, default: '#8b5cf6' })
  color!: string;

  @Column({ type: 'simple-json', default: () => "'[]'" })
  tags!: string[];

  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  settings?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relationships
  @OneToMany(() => Thread, thread => thread.project)
  threads!: Thread[];

  @OneToMany(() => Document, doc => doc.project)
  documents!: Document[];
}
