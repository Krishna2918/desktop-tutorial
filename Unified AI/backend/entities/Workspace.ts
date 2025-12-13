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
import { User } from './User';
import { Organization } from './Organization';
import { Project } from './Project';
import { WorkspaceMember } from './WorkspaceMember';

export enum WorkspaceOwnerType {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION'
}

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'simple-enum',
    enum: WorkspaceOwnerType
  })
  ownerType!: WorkspaceOwnerType;

  @ManyToOne(() => User, user => user.ownedWorkspaces, { nullable: true })
  @JoinColumn({ name: 'userId' })
  userOwner?: User;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => Organization, org => org.workspaces, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organizationOwner?: Organization;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({ type: 'varchar', length: 100, default: '📁' })
  icon!: string;

  @Column({ type: 'varchar', length: 7, default: '#3b82f6' })
  color!: string;

  @Column({ type: 'simple-json', nullable: true })
  settings?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isArchived!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relationships
  @OneToMany(() => Project, project => project.workspace)
  projects!: Project[];

  @OneToMany(() => WorkspaceMember, member => member.workspace)
  members!: WorkspaceMember[];
}
