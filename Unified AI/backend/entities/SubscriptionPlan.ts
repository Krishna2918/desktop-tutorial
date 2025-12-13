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
import { User } from './User';
import { Organization } from './Organization';
import { Invoice } from './Invoice';

export enum PlanType {
  FREE = 'FREE',
  INDIVIDUAL_BASIC = 'INDIVIDUAL_BASIC',
  INDIVIDUAL_PRO = 'INDIVIDUAL_PRO',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE'
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAST_DUE = 'PAST_DUE'
}

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

@Entity('subscription_plans')
@Index(['userId', 'status'])
@Index(['organizationId', 'status'])
@Index(['externalSubscriptionId'], { unique: true })
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, user => user.subscription, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => Organization, organization => organization.subscription, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({
    type: 'simple-enum',
    enum: PlanType,
    default: PlanType.FREE
  })
  planType!: PlanType;

  @Column({
    type: 'simple-enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE
  })
  status!: SubscriptionStatus;

  @Column({
    type: 'simple-enum',
    enum: BillingInterval,
    nullable: true
  })
  billingInterval?: BillingInterval;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'datetime', nullable: true })
  currentPeriodStart?: Date;

  @Column({ type: 'datetime', nullable: true })
  currentPeriodEnd?: Date;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: 'datetime', nullable: true })
  trialEndsAt?: Date;

  @Column({ type: 'simple-json', nullable: true })
  features?: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalSubscriptionId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relationships
  @OneToMany(() => Invoice, invoice => invoice.subscription)
  invoices!: Invoice[];
}
