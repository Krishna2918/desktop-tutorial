import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

@Entity('organization_members')
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organization, org => org.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => User, user => user.organizationMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'simple-enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER
  })
  role!: OrganizationRole;

  @Column({ type: 'simple-json', nullable: true })
  permissions?: Record<string, boolean>;

  @CreateDateColumn()
  joinedAt!: Date;
}
