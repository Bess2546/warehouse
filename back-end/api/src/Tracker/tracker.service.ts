// src/trackers/trackers.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackerEntity } from './entities/tracker.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);

  constructor(
    @InjectRepository(TrackerEntity)
    private trackerRepo: Repository<TrackerEntity>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  // ==================== GET ORGANIZE BY M5 IMEI ====================
  async getOrganizeByM5(imei: string): Promise<Organization | null> {
    if (!imei) return null;

    // หา Tracker จาก IMEI
    const tracker = await this.trackerRepo.findOne({
      where: { imei, isActive: true },
      relations: ['organization'],
    });

    if (!tracker) {
      this.logger.warn(`Tracker not found for IMEI: ${imei}`);
      return null;
    }

    if (!tracker.organization) {
      this.logger.warn(`Tracker ${imei} has no organization assigned`);
      return null;
    }

    this.logger.log(`Found org for IMEI ${imei}: ${tracker.organization.name}`);
    return tracker.organization;
  }

  // ==================== CRUD ====================

  async findAll(): Promise<TrackerEntity[]> {
    return this.trackerRepo.find({
      where: { isActive: true },
      relations: ['organization'],
      order: { id: 'ASC' },
    });
  }

  async findByImei(imei: string): Promise<TrackerEntity | null> {
    return this.trackerRepo.findOne({
      where: { imei, isActive: true },
      relations: ['organization'],
    });
  }

  async findById(id: number): Promise<TrackerEntity | null> {
    return this.trackerRepo.findOne({
      where: { id, isActive: true },
      relations: ['organization'],
    });
  }

  async create(data: {
    imei: string;
    serialNumber?: string;
    brand?: string;
    model?: string;
    description?: string;
    version?: string;
  }): Promise<TrackerEntity> {
    // Check duplicate IMEI
    const existing = await this.trackerRepo.findOne({ where: { imei: data.imei } });
    if (existing) {
      throw new Error('IMEI already exists');
    }

    const tracker = this.trackerRepo.create({
      ...data,
      status: 'STOCKED',
      isActive: true,
    });

    return this.trackerRepo.save(tracker);
  }

  async assignToOrganization(imei: string, organizationId: number): Promise<TrackerEntity> {
    const tracker = await this.trackerRepo.findOne({ where: { imei, isActive: true } });
    if (!tracker) {
      throw new Error('Tracker not found');
    }

    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new Error('Organization not found');
    }

    tracker.organizationId = organizationId;
    tracker.status = 'ACTIVE';

    this.logger.log(`Assigned tracker ${imei} to org ${org.name}`);
    return this.trackerRepo.save(tracker);
  }

  async updateStatus(imei: string, status: TrackerEntity['status']): Promise<TrackerEntity> {
    const tracker = await this.trackerRepo.findOne({ where: { imei, isActive: true } });
    if (!tracker) {
      throw new Error('Tracker not found');
    }

    tracker.status = status;
    return this.trackerRepo.save(tracker);
  }

  async updateLastSeen(imei: string, lastSeen: Date, lastBattery?: number): Promise<void> {
    await this.trackerRepo.update(
      { imei },
      { lastSeen, lastBattery, updatedAt: new Date() },
    );
  }

  async delete(id: number): Promise<void> {
    await this.trackerRepo.update(id, { isActive: false });
  }
}