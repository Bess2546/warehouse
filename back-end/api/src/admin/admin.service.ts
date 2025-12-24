// src/admin/admin.service.ts
import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateUserDto,
  UpdateUserDto,
} from '../auth/dto/admin.dto';

// Type สำหรับ return User โดยไม่มี password
type UserWithoutPassword = Omit<User, 'password'>;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) { }

  // ==================== Helper Functions ====================

  // ลบ password ออกจาก User object
  private excludePassword(user: User): UserWithoutPassword {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // ตรวจสอบสิทธิ์ Admin
  private async checkAdminPermission(targetUserId: number, currentUser: any): Promise<User> {
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['organization'],
    });

    if (!targetUser) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    // Super Admin ทำได้ทุกอย่าง
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return targetUser;
    }

    // Admin จัดการได้เฉพาะ User (ไม่ใช่ Admin หรือ Super Admin)
    if (currentUser.role === UserRole.ADMIN) {
      if (targetUser.role === UserRole.ADMIN || targetUser.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการผู้ใช้ที่มี Role สูงกว่าหรือเท่ากับ');
      }
    }

    return targetUser;
  }

  // ==================== Organization Management ====================
  // Super Admin เท่านั้น

  async createOrganization(dto: CreateOrganizationDto): Promise<Organization> {
    const existing = await this.organizationRepository.findOne({
      where: [{ name: dto.name }, { code: dto.code }],
    });

    if (existing) {
      throw new ConflictException('ชื่อหรือรหัสบริษัทนี้มีอยู่แล้ว');
    }

    const organization = this.organizationRepository.create(dto);
    return this.organizationRepository.save(organization);
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return this.organizationRepository.find({
      order: { name: 'ASC' },
    });
  }

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

  async updateOrganization(id: number, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.getOrganizationById(id);
    Object.assign(org, dto);
    return this.organizationRepository.save(org);
  }

  async deleteOrganization(id: number): Promise<{ message: string }> {
    const org = await this.getOrganizationById(id);
    org.isActive = false;
    await this.organizationRepository.save(org);
    return { message: 'ลบบริษัทสำเร็จ' };
  }

  // ==================== User Management ====================

  async createUser(dto: CreateUserDto, currentUser: any): Promise<UserWithoutPassword> {
    const roleToCreate = dto.role || UserRole.USER;

    // Admin สร้างได้เฉพาะ User เท่านั้น (แต่สร้างให้ org ไหนก็ได้)
    if (currentUser.role === UserRole.ADMIN) {
      if (roleToCreate !== UserRole.USER) {
        throw new ForbiddenException('Admin สามารถสร้างได้เฉพาะ User เท่านั้น');
      }
    }

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

    // User ต้องมี Organization
    if (roleToCreate === UserRole.USER) {
      if (!dto.organizationId) {
        throw new ForbiddenException('User ต้องเลือก Organization');
      }
      const org = await this.organizationRepository.findOne({
        where: { id: dto.organizationId },
      });
      if (!org) {
        throw new NotFoundException('ไม่พบบริษัทที่เลือก');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // สร้าง user object
    const newUser = new User();
    newUser.username = dto.username;
    newUser.email = dto.email;
    newUser.fullName = dto.fullName || '';
    newUser.password = hashedPassword;
    newUser.role = roleToCreate;

    // Admin และ Super Admin ไม่มี organizationId
    if (roleToCreate === UserRole.USER && dto.organizationId) {
      newUser.organizationId = dto.organizationId;
    }

    const savedUser = await this.userRepository.save(newUser);
    return this.excludePassword(savedUser);
  }

  // ดู Users ทั้งหมด (Admin และ Super Admin)
  async getAllUsers(currentUser): Promise<UserWithoutPassword[]> {
    let users: User[];

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // Super Admin เห็นทุกคน
      users = await this.userRepository.find({
        relations: ['organization'],
        order: { createdAt: 'DESC' },
      });
    } else if (currentUser.role === UserRole.ADMIN) {
      // Admin เห็นเฉพาะ User (ไม่เห็น Admin และ Super Admin)
      users = await this.userRepository.find({
        where: { role: UserRole.USER },
        relations: ['organization'],
        order: { createdAt: 'DESC' },
      });
    } else {
      users = [];
    }


    return users.map(user => this.excludePassword(user));
  }

  // ดู Users ตาม Organization
  async getUsersByOrganization(orgId: number): Promise<UserWithoutPassword[]> {
    const users = await this.userRepository.find({
      where: { organizationId: orgId },
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });

    return users.map(user => this.excludePassword(user));
  }

  // ดู User ตาม ID
  async getUserById(id: number): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    return this.excludePassword(user);
  }

  // อัพเดท User
  async updateUser(id: number, dto: UpdateUserDto, currentUser: any): Promise<UserWithoutPassword> {
    const targetUser = await this.checkAdminPermission(id, currentUser);

    // Admin เปลี่ยน role เป็น admin/super_admin ไม่ได้
    if (currentUser.role === UserRole.ADMIN && dto.role) {
      if (dto.role !== UserRole.USER) {
        throw new ForbiddenException('Admin ไม่สามารถเปลี่ยน Role เป็น Admin หรือ Super Admin ได้');
      }
    }

    // อัพเดทเฉพาะ fields ที่ส่งมา
    if (dto.email) targetUser.email = dto.email;
    if (dto.fullName !== undefined) targetUser.fullName = dto.fullName;
    if (dto.role) targetUser.role = dto.role;
    if (dto.isActive !== undefined) targetUser.isActive = dto.isActive;
    if (dto.organizationId !== undefined) targetUser.organizationId = dto.organizationId;

    const savedUser = await this.userRepository.save(targetUser);
    return this.excludePassword(savedUser);
  }

  // Reset รหัสผ่าน
  async resetPassword(userId: number, newPassword: string, currentUser: any): Promise<{ message: string }> {
    const targetUser = await this.checkAdminPermission(userId, currentUser);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    targetUser.password = hashedPassword;
    await this.userRepository.save(targetUser);

    return { message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
  }

  // ลบ User
  async deleteUser(id: number, currentUser: any): Promise<{ message: string }> {
    const targetUser = await this.checkAdminPermission(id, currentUser);

    if (targetUser.id === currentUser.userId) {
      throw new ForbiddenException('ไม่สามารถลบบัญชีตัวเองได้');
    }

    targetUser.isActive = false;
    await this.userRepository.save(targetUser);

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