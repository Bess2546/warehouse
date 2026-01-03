// src/shipments/entities/shipment-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shipment } from './shipment.entity';

export enum ShipmentItemStatus {
  PENDING = 'pending',           
  IN_TRANSIT = 'in_transit',     
  DELIVERED = 'delivered',       
}

@Entity('shipment_items')
export class ShipmentItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shipment_id' })
  shipmentId: number;

  @Column({ name: 'tag_uid' })
  tagUid: string;

  @Column({ name: 'tag_name', nullable: true })
  tagName: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ShipmentItemStatus.PENDING,
  })
  status: ShipmentItemStatus;

  @Column({ name: 'exited_at', nullable: true })
  exitedAt: Date;

  @Column({ name: 'arrived_at', nullable: true })
  arrivedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Shipment, (shipment) => shipment.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;
}