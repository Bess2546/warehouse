// src/Tracker/entities/tracker.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('trackers')
export class TrackerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  imei: string;

  @Column({ name: 'serial_number', nullable: true })
  serialNumber: string;

  @Column({ nullable: true })
  brand: string;

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  version: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'STOCKED'],
    default: 'STOCKED',
  })
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'STOCKED';

  @Column({ name: 'organization_id', nullable: true })
  organizationId: number;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen: Date;

  @Column({ name: 'last_battery', nullable: true })
  lastBattery: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}