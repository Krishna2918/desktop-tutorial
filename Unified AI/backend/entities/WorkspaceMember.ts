import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Workspace } from './Workspace';
import { User } from './User';

export enum WorkspaceRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER'
}

@Entity('workspace_members')
export class WorkspaceMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Workspace, workspace => workspace.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @Column({ type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'simple-enum',
    enum: WorkspaceRole,
    default: WorkspaceRole.VIEWER
  })
  role!: WorkspaceRole;

  @Column({ type: 'simple-json', nullable: true })
  permissions?: Record<string, boolean>;

  @CreateDateColumn()
  addedAt!: Date;
}
