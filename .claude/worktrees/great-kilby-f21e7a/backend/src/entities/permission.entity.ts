import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 128 })
  code: string;

  @Column({ length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'menu' })
  type: string;

  @Column({ name: 'route_path', length: 255, default: '' })
  routePath: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
