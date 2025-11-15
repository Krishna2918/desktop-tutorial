import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { User } from './User';
import { Organization } from './Organization';
import { AIInteraction } from './AIInteraction';

@Entity('ai_provider_configs')
export class AIProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, user => user.providerConfigs, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({ type: 'varchar', length: 100 })
  providerKey!: string;

  @Column({ type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ type: 'text' })
  apiKeyEncrypted!: string;

  @Column({ type: 'varchar', length: 500 })
  apiEndpoint!: string;

  @Column({ type: 'simple-json', nullable: true })
  settings?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt?: Date;

  // Relationships
  @OneToMany(() => AIInteraction, interaction => interaction.providerConfig)
  interactions!: AIInteraction[];
}
