// src/auth/suth.service.ts

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // Validate user สำหรับ LocalStrategy
  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsernameWithOrg(username);
   
     console.log('=== DEBUG ===');
    console.log('Found user:', user);
    console.log('Password from DB:', user?.password);
    
    if (!user) {
      console.log('User not found!');
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('บัญชีถูกระงับการใช้งาน');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Password mismatch!');
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  // Login
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Username หรือ Password ไม่ถูกต้อง');
    }

    // สร้าง JWT payload
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId || null,
    };

    // อัพเดท lastLogin
    await this.usersService.updateLastLogin(user.id);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization || null,
      },
    };
  }

  // ดึง Profile
  async getProfile(userId: number) {
    const user = await this.usersService.findByIdWithOrg(userId);
    
    if (!user) {
      throw new UnauthorizedException('ไม่พบผู้ใช้');
    }

    const { password: _, ...result } = user;
    return result;
  }

  // เปลี่ยนรหัสผ่าน
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findOne(userId);
    
    if (!user) {
      throw new UnauthorizedException('ไม่พบผู้ใช้');
    }

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    // Hash รหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, { password: hashedPassword });

    return { message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  }
}