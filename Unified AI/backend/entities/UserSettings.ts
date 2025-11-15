import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './User';

@Entity('user_settings')
@Index(['userId', 'category', 'key'], { unique: true })
@Index(['userId', 'category'])
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, user => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  key!: string;

  @Column({ type: 'simple-json' })
  value!: any;

  @UpdateDateColumn()
  updatedAt!: Date;
}
