// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  // ==================== VALIDATE USER ====================
  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsernameWithOrg(username);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('บัญชีถูกระงับการใช้งาน');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  // ==================== LOGIN ====================
  async login(loginDto: LoginDto, deviceInfo?: string) {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Username หรือ Password ไม่ถูกต้อง');
    }

    // สร้าง Access Token (อายุสั้น 30 นาที)
    const accessToken = this.generateAccessToken(user);

    // สร้าง Refresh Token (อายุยาว 7 วัน)
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo);

    // อัพเดท lastLogin
    await this.usersService.updateLastLogin(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken, // จะส่งเป็น HttpOnly Cookie
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

  // ==================== GENERATE ACCESS TOKEN ====================
  generateAccessToken(user: any): string {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId || null,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '30m', // 30 นาที
    });
  }

  // ==================== GENERATE REFRESH TOKEN ====================
  async generateRefreshToken(userId: number, deviceInfo?: string): Promise<string> {
    // สร้าง random token
    const token = crypto.randomBytes(64).toString('hex');

    // Hash token ก่อนเก็บใน DB
    const tokenHash = await bcrypt.hash(token, 10);

    // กำหนดวันหมดอายุ (7 วัน)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // บันทึกลง DB
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      deviceInfo: deviceInfo ?? undefined,
      revoked: false,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return token; // ส่ง token จริงไปให้ client
  }

  // ==================== REFRESH TOKEN ====================
  async refreshAccessToken(refreshToken: string) {
    // หา token ที่ยังไม่หมดอายุและยังไม่ถูก revoke
    const tokens = await this.refreshTokenRepository.find({
      where: { revoked: false },
      relations: ['user', 'user.organization'],
    });

    // หา token ที่ตรงกัน
    let matchedToken: RefreshToken | null = null;
    for (const t of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, t.tokenHash);
      if (isMatch) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // เช็คว่าหมดอายุหรือยัง
    if (new Date() > matchedToken.expiresAt) {
      // Revoke token ที่หมดอายุ
      matchedToken.revoked = true;
      await this.refreshTokenRepository.save(matchedToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    // ============ TOKEN ROTATION ============
    // Revoke token เก่า
    matchedToken.revoked = true;
    await this.refreshTokenRepository.save(matchedToken);

    // สร้าง token ใหม่
    const user = matchedToken.user;
    const newRefreshToken = await this.generateRefreshToken(user.id, matchedToken.deviceInfo ?? undefined);
    const newAccessToken = this.generateAccessToken(user);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
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

  // ==================== LOGOUT ====================
  async logout(refreshToken: string) {
    // หา token ที่ตรงกัน
    const tokens = await this.refreshTokenRepository.find({
      where: { revoked: false },
    });

    for (const t of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, t.tokenHash);
      if (isMatch) {
        t.revoked = true;
        await this.refreshTokenRepository.save(t);
        return { message: 'Logout สำเร็จ' };
      }
    }

    return { message: 'Logout สำเร็จ' };
  }

  // ==================== LOGOUT ALL DEVICES ====================
  async logoutAllDevices(userId: number) {
    await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );

    return { message: 'Logout จากทุกอุปกรณ์สำเร็จ' };
  }

  // ==================== GET ACTIVE SESSIONS ====================
  async getActiveSessions(userId: number) {
    const sessions = await this.refreshTokenRepository.find({
      where: { userId, revoked: false },
      order: { createdAt: 'DESC' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  // ==================== REVOKE SESSION ====================
  async revokeSession(userId: number, sessionId: number) {
    const session = await this.refreshTokenRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('ไม่พบ session');
    }

    session.revoked = true;
    await this.refreshTokenRepository.save(session);

    return { message: 'Revoke session สำเร็จ' };
  }

  // ==================== CLEANUP EXPIRED TOKENS ====================
  async cleanupExpiredTokens() {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .orWhere('revoked = :revoked', { revoked: true })
      .execute();

    return { deleted: result.affected };
  }

  // ==================== GET PROFILE ====================
  async getProfile(userId: number) {
    const user = await this.usersService.findByIdWithOrg(userId);

    if (!user) {
      throw new UnauthorizedException('ไม่พบผู้ใช้');
    }

    const { password: _, ...result } = user;
    return result;
  }

  // ==================== CHANGE PASSWORD ====================
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

    // Revoke ทุก refresh token (บังคับ login ใหม่)
    await this.logoutAllDevices(userId);

    return { message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' };
  }
}