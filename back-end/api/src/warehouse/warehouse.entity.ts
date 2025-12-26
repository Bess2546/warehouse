import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/entities/organization.entity';
import { TrackerEntity } from '../Tracker/entities/tracker.entity';

@Entity('warehouse')
export class WarehouseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({
    type: 'enum',
    enum: ['ORIGIN', 'DESTINATION', 'HUB'],
    default: 'HUB',
  })
  type: 'ORIGIN' | 'DESTINATION' | 'HUB';

  @Column({ name: 'organization_id' })
  organizationId: number;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // M5 Device ที่ติดตั้งที่ warehouse นี้
  @Column({ name: 'tracker_id', nullable: true })
  trackerId: number;

  @ManyToOne(() => TrackerEntity, { nullable: true })
  @JoinColumn({ name: 'tracker_id' })
  tracker: TrackerEntity;

  // Location
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}