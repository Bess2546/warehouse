// src/shipments/entities/shipment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { WarehouseEntity } from '../../warehouse/warehouse.entity';
import { ShipmentItem } from './shipment-item.entity';

export enum ShipmentStatus {
  PENDING = 'pending',           // รอส่ง
  IN_TRANSIT = 'in_transit',     // กำลังส่ง
  PARTIAL = 'partial',           // ส่งถึงบางส่วน
  DELIVERED = 'delivered',       // ส่งถึงแล้ว
  CANCELLED = 'cancelled',       // ยกเลิก
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shipment_code', unique: true })
  shipmentCode: string;

  @Column({ name: 'origin_warehouse_id' })
  originWarehouseId: number;

  @Column({ name: 'destination_warehouse_id' })
  destinationWarehouseId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: ShipmentStatus.PENDING,
  })
  status: ShipmentStatus;

  @Column({ nullable: true })
  notes: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @Column({ name: 'org_id', nullable: true })
  orgId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'origin_warehouse_id' })
  originWarehouse: WarehouseEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'destination_warehouse_id' })
  destinationWarehouse: WarehouseEntity;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => ShipmentItem, (item) => item.shipment)
  items: ShipmentItem[];
}