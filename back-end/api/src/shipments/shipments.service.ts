// src/shipments/shipments.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { ShipmentItem, ShipmentItemStatus } from './entities/shipment-item.entity';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
    @InjectRepository(ShipmentItem)
    private shipmentItemRepository: Repository<ShipmentItem>,
  ) {}

  // ==================== CRUD ====================

  // สร้าง Shipment ใหม่
  async create(dto: CreateShipmentDto, userId: number): Promise<Shipment> {
    // Validate: ต้นทาง ≠ ปลายทาง
    if (dto.originWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException('ต้นทางและปลายทางต้องไม่เหมือนกัน');
    }

    // สร้าง shipment code: SHP-YYYYMMDD-XXXX
    const shipmentCode = await this.generateShipmentCode();

    // สร้าง Shipment
    const shipment = this.shipmentRepository.create({
      shipmentCode,
      originWarehouseId: dto.originWarehouseId,
      destinationWarehouseId: dto.destinationWarehouseId,
      notes: dto.notes,
      orgId: dto.orgId,
      createdBy: userId,
      status: ShipmentStatus.PENDING,
    });

    const savedShipment = await this.shipmentRepository.save(shipment);

    // สร้าง Shipment Items (Tags)
    const items = dto.tagUids.map((tagUid) =>
      this.shipmentItemRepository.create({
        shipmentId: savedShipment.id,
        tagUid,
        status: ShipmentItemStatus.PENDING,
      }),
    );

    await this.shipmentItemRepository.save(items);

    return this.findOne(savedShipment.id);
  }

  // ดึง Shipments ทั้งหมด
  async findAll(query: { status?: string; orgId?: number; page?: number; limit?: number }) {
    const { status, orgId, page = 1, limit = 20 } = query;

    const qb = this.shipmentRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.originWarehouse', 'origin')
      .leftJoinAndSelect('s.destinationWarehouse', 'destination')
      .leftJoinAndSelect('s.items', 'items')
      .leftJoinAndSelect('s.creator', 'creator')
      .orderBy('s.createdAt', 'DESC');

    if (status) {
      qb.andWhere('s.status = :status', { status });
    }

    if (orgId) {
      qb.andWhere('s.orgId = :orgId', { orgId });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ดึง Shipment ตาม ID
  async findOne(id: number): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({
      where: { id },
      relations: ['originWarehouse', 'destinationWarehouse', 'items', 'creator'],
    });

    if (!shipment) {
      throw new NotFoundException('ไม่พบ Shipment');
    }

    return shipment;
  }

  // ดึง Shipment ตาม Code
  async findByCode(code: string): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({
      where: { shipmentCode: code },
      relations: ['originWarehouse', 'destinationWarehouse', 'items', 'creator'],
    });

    if (!shipment) {
      throw new NotFoundException('ไม่พบ Shipment');
    }

    return shipment;
  }

  // อัพเดท Shipment
  async update(id: number, dto: UpdateShipmentDto): Promise<Shipment> {
    const shipment = await this.findOne(id);

    if (dto.status) {
      shipment.status = dto.status as ShipmentStatus;
    }
    if (dto.notes !== undefined) {
      shipment.notes = dto.notes;
    }

    await this.shipmentRepository.save(shipment);
    return this.findOne(id);
  }

  // ยกเลิก Shipment
  async cancel(id: number): Promise<Shipment> {
    const shipment = await this.findOne(id);

    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException('ไม่สามารถยกเลิก Shipment ที่ส่งถึงแล้ว');
    }

    shipment.status = ShipmentStatus.CANCELLED;
    await this.shipmentRepository.save(shipment);

    return shipment;
  }

  // ลบ Shipment
  async remove(id: number): Promise<void> {
    const shipment = await this.findOne(id);
    await this.shipmentRepository.remove(shipment);
  }

  // ==================== HYBRID LOGIC ====================

  // เรียกเมื่อ Tag เปลี่ยน location (จาก tag-movement service)
  async onTagLocationChange(
    tagUid: string,
    previousWarehouse: string | null,
    currentWarehouse: string,
    timestamp: Date,
  ): Promise<void> {
    // หา Shipment Items ที่มี tag นี้ และยังไม่เสร็จ
    const items = await this.shipmentItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.shipment', 'shipment')
      .leftJoinAndSelect('shipment.originWarehouse', 'origin')
      .leftJoinAndSelect('shipment.destinationWarehouse', 'destination')
      .where('item.tagUid = :tagUid', { tagUid })
      .andWhere('item.status != :delivered', { delivered: ShipmentItemStatus.DELIVERED })
      .andWhere('shipment.status NOT IN (:...statuses)', {
        statuses: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
      })
      .getMany();

    for (const item of items) {
      const shipment = item.shipment;
      const originName = shipment.originWarehouse?.name;
      const destinationName = shipment.destinationWarehouse?.name;

      // Tag ออกจากต้นทาง
      if (previousWarehouse === originName && currentWarehouse !== originName) {
        item.status = ShipmentItemStatus.IN_TRANSIT;
        item.exitedAt = timestamp;
        await this.shipmentItemRepository.save(item);
      }

      // Tag ถึงปลายทาง
      if (currentWarehouse === destinationName) {
        item.status = ShipmentItemStatus.DELIVERED;
        item.arrivedAt = timestamp;
        await this.shipmentItemRepository.save(item);
      }

      // อัพเดท Shipment Status
      await this.recalculateShipmentStatus(shipment.id);
    }
  }

  // เรียกเมื่อ Tag หายไปจาก Warehouse (ไม่เจอนานเกิน threshold)
  async onTagExitWarehouse(
    tagUid: string,
    warehouseName: string,
    timestamp: Date,
  ): Promise<void> {
    const items = await this.shipmentItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.shipment', 'shipment')
      .leftJoinAndSelect('shipment.originWarehouse', 'origin')
      .where('item.tagUid = :tagUid', { tagUid })
      .andWhere('item.status = :pending', { pending: ShipmentItemStatus.PENDING })
      .andWhere('shipment.status = :status', { status: ShipmentStatus.PENDING })
      .getMany();

    for (const item of items) {
      const originName = item.shipment.originWarehouse?.name;

      if (warehouseName === originName) {
        item.status = ShipmentItemStatus.IN_TRANSIT;
        item.exitedAt = timestamp;
        await this.shipmentItemRepository.save(item);
        await this.recalculateShipmentStatus(item.shipment.id);
      }
    }
  }

  async onTagMovement(
  tagUid: string,
  action: 'IN' | 'OUT',
  warehouseId: number,
  orgId: number,
): Promise<void> {
  
  const items = await this.shipmentItemRepository
    .createQueryBuilder('item')
    .leftJoinAndSelect('item.shipment', 'shipment')
    .leftJoinAndSelect('shipment.originWarehouse', 'origin')
    .leftJoinAndSelect('shipment.destinationWarehouse', 'destination')
    .where('item.tagUid = :tagUid', { tagUid })
    .andWhere('item.status NOT IN (:...itemStatuses)', {
      itemStatuses: [ShipmentItemStatus.DELIVERED],
    })
    .andWhere('shipment.status NOT IN (:...shipmentStatuses)', {
      shipmentStatuses: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
    })
    .getMany();

  if (items.length === 0) {
    console.log(`[Shipments] Tag ${tagUid} not in any active shipment`);
    return;
  }

  for (const item of items) {
    const shipment = item.shipment;
    const originId = shipment.originWarehouse?.id;
    const destinationId = shipment.destinationWarehouse?.id;

    // OUT จากคลังต้นทาง → in_transit
    if (action === 'OUT' && warehouseId === originId) {
      item.status = ShipmentItemStatus.IN_TRANSIT;
      item.exitedAt = new Date();
      await this.shipmentItemRepository.save(item);
      console.log(`[Shipments] Tag ${tagUid} exited origin warehouse → in_transit`);
    }

    // IN ที่คลังปลายทาง → delivered
    if (action === 'IN' && warehouseId === destinationId) {
      item.status = ShipmentItemStatus.DELIVERED;
      item.arrivedAt = new Date();
      await this.shipmentItemRepository.save(item);
      console.log(`[Shipments] Tag ${tagUid} arrived at destination → delivered`);
    }

    // คำนวณ Shipment status ใหม่
    await this.recalculateShipmentStatus(shipment.id);
  }
}

  // คำนวณ Shipment Status ใหม่จาก Items
  async recalculateShipmentStatus(shipmentId: number): Promise<void> {
    const shipment = await this.findOne(shipmentId);
    const items = shipment.items;

    if (!items || items.length === 0) return;

    const total = items.length;
    const pending = items.filter((i) => i.status === ShipmentItemStatus.PENDING).length;
    const inTransit = items.filter((i) => i.status === ShipmentItemStatus.IN_TRANSIT).length;
    const delivered = items.filter((i) => i.status === ShipmentItemStatus.DELIVERED).length;

    let newStatus: ShipmentStatus;

    if (pending === total) {
      newStatus = ShipmentStatus.PENDING;        // ทุก Tag ยังอยู่ต้นทาง
    } else if (delivered === total) {
      newStatus = ShipmentStatus.DELIVERED;      // ทุก Tag ถึงปลายทาง
    } else if (delivered > 0) {
      newStatus = ShipmentStatus.PARTIAL;        // บาง Tag ถึงแล้ว
    } else {
      newStatus = ShipmentStatus.IN_TRANSIT;     // กำลังเดินทาง
    }

    if (shipment.status !== newStatus) {
      shipment.status = newStatus;
      await this.shipmentRepository.save(shipment);
    }
  }

  // ==================== HELPERS ====================

  private async generateShipmentCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // หา shipment ล่าสุดของวันนี้
    const lastShipment = await this.shipmentRepository
      .createQueryBuilder('s')
      .where('s.shipmentCode LIKE :pattern', { pattern: `SHP-${dateStr}-%` })
      .orderBy('s.shipmentCode', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastShipment) {
      const lastSeq = parseInt(lastShipment.shipmentCode.split('-')[2], 10);
      sequence = lastSeq + 1;
    }

    return `SHP-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  // ดึง Shipments ที่มี Tag นี้
  async findByTagUid(tagUid: string): Promise<Shipment[]> {
    const items = await this.shipmentItemRepository.find({
      where: { tagUid },
      relations: ['shipment', 'shipment.originWarehouse', 'shipment.destinationWarehouse'],
    });

    return items.map((item) => item.shipment);
  }

  // ดึงสถิติ Shipments
  async getStats(orgId?: number) {
    const qb = this.shipmentRepository.createQueryBuilder('s');

    if (orgId) {
      qb.where('s.orgId = :orgId', { orgId });
    }

    const [pending, inTransit, partial, delivered, cancelled] = await Promise.all([
      qb.clone().andWhere('s.status = :s', { s: ShipmentStatus.PENDING }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: ShipmentStatus.IN_TRANSIT }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: ShipmentStatus.PARTIAL }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: ShipmentStatus.DELIVERED }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: ShipmentStatus.CANCELLED }).getCount(),
    ]);

    return {
      total: pending + inTransit + partial + delivered + cancelled,
      pending,
      inTransit,
      partial,
      delivered,
      cancelled,
    };
  }
}