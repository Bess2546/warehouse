// src/warehouses/warehouses.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseEntity } from '../warehouse/warehouse.entity';
import { TrackerEntity } from '../Tracker/entities/tracker.entity';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(
    @InjectRepository(WarehouseEntity)
    private warehouseRepo: Repository<WarehouseEntity>,
    @InjectRepository(TrackerEntity)
    private trackerRepo: Repository<TrackerEntity>,
  ) {}

  // ==================== หา Warehouse จาก M5 IMEI ====================
  async getWarehouseByM5(imei: string): Promise<WarehouseEntity | null> {
    if (!imei) return null;

    // หา Tracker ก่อน
    const tracker = await this.trackerRepo.findOne({
      where: { imei, isActive: true },
    });

    if (!tracker) {
      this.logger.debug(`Tracker not found for IMEI: ${imei}`);
      return null;
    }

    // หา Warehouse ที่ tracker นี้ติดตั้งอยู่
    const warehouse = await this.warehouseRepo.findOne({
      where: { trackerId: tracker.id, isActive: true },
      relations: ['organization', 'tracker'],
    });

    if (!warehouse) {
      this.logger.debug(`No warehouse assigned for tracker: ${imei}`);
      return null;
    }

    this.logger.log(`Found warehouse for IMEI ${imei}: ${warehouse.name}`);
    return warehouse;
  }

  // ==================== CRUD ====================

  async findAll(organizationId?: number): Promise<WarehouseEntity[]> {
    const where: any = { isActive: true };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.warehouseRepo.find({
      where,
      relations: ['organization', 'tracker'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: number): Promise<WarehouseEntity | null> {
    return this.warehouseRepo.findOne({
      where: { id, isActive: true },
      relations: ['organization', 'tracker'],
    });
  }

  async findByCode(code: string): Promise<WarehouseEntity | null> {
    return this.warehouseRepo.findOne({
      where: { code, isActive: true },
      relations: ['organization', 'tracker'],
    });
  }

  async create(data: {
    name: string;
    code: string;
    type: 'ORIGIN' | 'DESTINATION' | 'HUB';
    organizationId: number;
    trackerId?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    phone?: string;
  }): Promise<WarehouseEntity> {
    const existing = await this.warehouseRepo.findOne({ where: { code: data.code } });
    if (existing) {
      throw new Error('Warehouse code already exists');
    }

    const warehouse = this.warehouseRepo.create({
      ...data,
      isActive: true,
    });

    this.logger.log(`Created warehouse: ${data.name}`);
    return this.warehouseRepo.save(warehouse);
  }

  async update(id: number, data: Partial<WarehouseEntity>): Promise<WarehouseEntity> {
    const warehouse = await this.warehouseRepo.findOne({ where: { id } });
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    Object.assign(warehouse, data);
    return this.warehouseRepo.save(warehouse);
  }

  async assignTracker(warehouseId: number, trackerId: number): Promise<WarehouseEntity> {
    const warehouse = await this.warehouseRepo.findOne({ where: { id: warehouseId } });
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    const tracker = await this.trackerRepo.findOne({ where: { id: trackerId, isActive: true } });
    if (!tracker) {
      throw new Error('Tracker not found');
    }

    const existingWarehouse = await this.warehouseRepo.findOne({
      where: { trackerId, isActive: true },
    });
    if (existingWarehouse && existingWarehouse.id !== warehouseId) {
      throw new Error(`Tracker already assigned to ${existingWarehouse.name}`);
    }

    warehouse.trackerId = trackerId;
    this.logger.log(`Assigned tracker ${tracker.imei} to warehouse ${warehouse.name}`);

    return this.warehouseRepo.save(warehouse);
  }

  async delete(id: number): Promise<void> {
    await this.warehouseRepo.update(id, { isActive: false });
  }
}