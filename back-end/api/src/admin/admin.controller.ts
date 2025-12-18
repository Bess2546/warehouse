import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseIntPipe,} from '@nestjs/common';
import { AdminService } from './admin.service';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import {CreateOrganizationDto, UpdateOrganizationDto, CreateUserDto, UpdateUserDto, ResetPasswordDto,} from '../auth/dto/admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ==================== Dashboard ====================

  @Get('dashboard')
  @Roles(UserRole.SUPER_ADMIN)
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ==================== Organization Management ====================

  // ดึงรายการ Organizations ทั้งหมด
  @Get('organizations')
  async getOrganizations() {
    return this.adminService.getAllOrganizations();
  }

  // ดึง Organization ตาม ID
  @Get('organizations/:id')
  async getOrganization(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getOrganizationById(id);
  }

  // สร้าง Organization ใหม่ (Super Admin เท่านั้น)
  @Post('organizations')
  @Roles(UserRole.SUPER_ADMIN)
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  // อัพเดท Organization (Super Admin เท่านั้น)
  @Patch('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.adminService.updateOrganization(id, dto);
  }

  // ลบ Organization (Super Admin เท่านั้น)
  @Delete('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteOrganization(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteOrganization(id);
  }

  // ==================== User Management ====================

  // ดึงรายการ Users ทั้งหมด (Super Admin)
  @Get('users')
  @Roles(UserRole.SUPER_ADMIN)
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  // ดึง Users ตาม Organization
  @Get('organizations/:orgId/users')
  async getUsersByOrganization(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.adminService.getUsersByOrganization(orgId);
  }

  // ดึง User ตาม ID
  @Get('users/:id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  // สร้าง User ใหม่
  @Post('users')
  async createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  // อัพเดท User
  @Patch('users/:id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  // Reset รหัสผ่าน
  @Post('users/:id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.adminService.resetPassword(id, dto.newPassword);
  }

  // ลบ User
  @Delete('users/:id')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }
}