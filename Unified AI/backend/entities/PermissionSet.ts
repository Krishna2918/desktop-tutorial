import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './User';

export enum PermissionEntityType {
  WORKSPACE = 'WORKSPACE',
  PROJECT = 'PROJECT',
  THREAD = 'THREAD'
}

@Entity('permission_sets')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['expiresAt'])
export class PermissionSet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'simple-enum',
    enum: PermissionEntityType
  })
  entityType!: PermissionEntityType;

  @Column({ type: 'uuid' })
  entityId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'uuid', nullable: true })
  roleId?: string;

  @Column({ type: 'simple-json' })
  permissions!: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
    share?: boolean;
    export?: boolean;
    [key: string]: any;
  };

  @CreateDateColumn()
  grantedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date;
}
