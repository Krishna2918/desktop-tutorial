import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { SubscriptionPlan } from './SubscriptionPlan';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE'
}

@Entity('invoices')
@Index(['subscriptionId', 'createdAt'])
@Index(['invoiceNumber'], { unique: true })
@Index(['externalInvoiceId'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SubscriptionPlan, subscription => subscription.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription!: SubscriptionPlan;

  @Column({ type: 'uuid' })
  subscriptionId!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  invoiceNumber!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({
    type: 'simple-enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT
  })
  status!: InvoiceStatus;

  @Column({ type: 'datetime', nullable: true })
  paidAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalInvoiceId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
