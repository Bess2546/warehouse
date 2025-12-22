// src/admin/admin.services.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateUserDto,
  UpdateUserDto,
} from '../auth/dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  // ==================== Organization Management ====================

  // สร้าง Organization ใหม่
  async createOrganization(dto: CreateOrganizationDto): Promise<Organization> {
    // ตรวจสอบชื่อและ code ซ้ำ
    const existing = await this.organizationRepository.findOne({
      where: [{ name: dto.name }, { code: dto.code }],
    });

    if (existing) {
      throw new ConflictException('ชื่อหรือรหัสบริษัทนี้มีอยู่แล้ว');
    }

    const organization = this.organizationRepository.create(dto);
    return this.organizationRepository.save(organization);
  }

  // ดึงรายการ Organization ทั้งหมด
  async getAllOrganizations(): Promise<Organization[]> {
    return this.organizationRepository.find({
      order: { name: 'ASC' },
    });
  }

  // ดึง Organization ตาม ID
  async getOrganizationById(id: number): Promise<Organization> {
    const org = await this.organizationRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!org) {
      throw new NotFoundException('ไม่พบบริษัท');
    }

    return org;
  }

  // อัพเดท Organization
  async updateOrganization(id: number, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.getOrganizationById(id);
    Object.assign(org, dto);
    return this.organizationRepository.save(org);
  }

  // ลบ Organization (soft delete)
  async deleteOrganization(id: number): Promise<{ message: string }> {
    const org = await this.getOrganizationById(id);
    org.isActive = false;
    await this.organizationRepository.save(org);
    return { message: 'ลบบริษัทสำเร็จ' };
  }

  // ==================== User Management ====================

  // สร้าง User ใหม่
  async createUser(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // ตรวจสอบ username ซ้ำ
    const existingUsername = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username นี้ถูกใช้งานแล้ว');
    }

    // ตรวจสอบ email ซ้ำ
    const existingEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email นี้ถูกใช้งานแล้ว');
    }

    // ตรวจสอบ Organization
    const org = await this.organizationRepository.findOne({
      where: { id: dto.organizationId },
    });
    if (!org) {
      throw new NotFoundException('ไม่พบบริษัทที่เลือก');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // สร้าง user
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      role: dto.role || 'user',
    });

    const savedUser = await this.userRepository.save(user);
    const { password: _, ...result } = savedUser;
    return result as Omit<User, 'password'>;
  }

  // ดึงรายการ User ทั้งหมด
  async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find({
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });

    return users.map(({ password: _, ...user }) => user as Omit<User, 'password'>);
  }

  // ดึง Users ตาม Organization
  async getUsersByOrganization(orgId: number): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find({
      where: { organizationId: orgId },
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });

    return users.map(({ password: _, ...user }) => user as Omit<User, 'password'>);
  }

  // ดึง User ตาม ID
  async getUserById(id: number): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    const { password: _, ...result } = user;
    return result as Omit<User, 'password'>;
  }

  // อัพเดท User
  async updateUser(id: number, dto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    // ถ้าเปลี่ยน organization ให้ตรวจสอบว่ามีอยู่
    if (dto.organizationId) {
      const org = await this.organizationRepository.findOne({
        where: { id: dto.organizationId },
      });
      if (!org) {
        throw new NotFoundException('ไม่พบบริษัทที่เลือก');
      }
    }

    Object.assign(user, dto);
    const savedUser = await this.userRepository.save(user);
    const { password: _, ...result } = savedUser;
    return result as Omit<User, 'password'>;
  }

  // Reset รหัสผ่าน
  async resetPassword(userId: number, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return { message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
  }

  // ลบ User (soft delete)
  async deleteUser(id: number): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    user.isActive = false;
    await this.userRepository.save(user);

    return { message: 'ลบผู้ใช้สำเร็จ' };
  }

  // ==================== Dashboard Stats ====================

  async getDashboardStats() {
    const [totalOrgs, totalUsers, activeUsers] = await Promise.all([
      this.organizationRepository.count({ where: { isActive: true } }),
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
    ]);

    return {
      totalOrganizations: totalOrgs,
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
    };
  }
}