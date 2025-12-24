// src/admin/admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
} from '../auth/dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ==================== Dashboard ====================

  @Get('dashboard')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ==================== Organization Management ====================
  // Super Admin เท่านั้น (ยกเว้น GET)

  @Get('organizations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getOrganizations() {
    return this.adminService.getAllOrganizations();
  }

  @Get('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getOrganization(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getOrganizationById(id);
  }

  @Post('organizations')
  @Roles(UserRole.SUPER_ADMIN)
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  @Patch('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.adminService.updateOrganization(id, dto);
  }

  @Delete('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteOrganization(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteOrganization(id);
  }

  // ==================== User Management ====================
  // Admin และ Super Admin (Admin จัดการได้เฉพาะ role=user)

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getAllUsers(@CurrentUser() currentUser: any) {
    return this.adminService.getAllUsers(currentUser);
  }

  @Get('organizations/:orgId/users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getUsersByOrganization(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.adminService.getUsersByOrganization(orgId);
  }

  @Get('users/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Post('users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.adminService.createUser(dto, currentUser);
  }

  @Patch('users/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.adminService.updateUser(id, dto, currentUser);
  }

  @Post('users/:id/reset-password')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.adminService.resetPassword(id, dto.newPassword, currentUser);
  }

  @Delete('users/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.adminService.deleteUser(id, currentUser);
  }
}