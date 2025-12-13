import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
import { OrganizationMember } from './OrganizationMember';
import { Workspace } from './Workspace';
import { Device } from './Device';
import { AIProviderConfig } from './AIProviderConfig';
import { Thread } from './Thread';
import { UserSettings } from './UserSettings';
import { SubscriptionPlan } from './SubscriptionPlan';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  emailVerificationToken?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  passwordResetToken?: string;

  @Column({ type: 'datetime', nullable: true })
  passwordResetExpires?: Date;

  @Column({ type: 'simple-json', nullable: true })
  preferences?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'datetime', nullable: true })
  deletedAt?: Date;

  // Relationships
  @ManyToOne(() => SubscriptionPlan, { nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: SubscriptionPlan;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId?: string;

  @OneToMany(() => OrganizationMember, member => member.user)
  organizationMemberships!: OrganizationMember[];

  @OneToMany(() => Workspace, workspace => workspace.userOwner)
  ownedWorkspaces!: Workspace[];

  @OneToMany(() => Device, device => device.user)
  devices!: Device[];

  @OneToMany(() => AIProviderConfig, config => config.user)
  providerConfigs!: AIProviderConfig[];

  @OneToMany(() => Thread, thread => thread.createdBy)
  createdThreads!: Thread[];

  @OneToMany(() => UserSettings, settings => settings.user)
  settings!: UserSettings[];
}
