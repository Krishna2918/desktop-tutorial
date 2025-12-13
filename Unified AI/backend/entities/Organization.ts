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
import { OrganizationMember } from './OrganizationMember';
import { Workspace } from './Workspace';
import { SubscriptionPlan } from './SubscriptionPlan';

export enum OrganizationPlanType {
  FREE = 'FREE',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE'
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column({ type: 'uuid' })
  ownerId!: string;

  @Column({
    type: 'simple-enum',
    enum: OrganizationPlanType,
    default: OrganizationPlanType.FREE
  })
  plan!: OrganizationPlanType;

  @Column({ type: 'int', default: 5 })
  maxSeats!: number;

  @Column({ type: 'simple-json', nullable: true })
  settings?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  // Relationships
  @OneToMany(() => OrganizationMember, member => member.organization)
  members!: OrganizationMember[];

  @OneToMany(() => Workspace, workspace => workspace.organizationOwner)
  workspaces!: Workspace[];

  @ManyToOne(() => SubscriptionPlan, { nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: SubscriptionPlan;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId?: string;
}
