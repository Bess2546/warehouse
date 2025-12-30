// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
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

  async login(loginDto: LoginDto, deviceInfo?: string) {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Username หรือ Password ไม่ถูกต้อง');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo);
    await this.usersService.updateLastLogin(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
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

  generateAccessToken(user: any): string {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId || null,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '30m',
    });
  }
  async generateRefreshToken(
    userId: number,
    deviceInfo?: string,
  ): Promise<string> {
   
    const tokenId = crypto.randomBytes(16).toString('hex');
    const tokenSecret = crypto.randomBytes(32).toString('hex');

    // Hash เฉพาะ secret (bcrypt 1 ครั้งตอนสร้าง)
    const secretHash = await bcrypt.hash(tokenSecret, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenId,
      secretHash,
      expiresAt,
      deviceInfo: deviceInfo ?? undefined,
      revoked: false,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return `${tokenId}.${tokenSecret}`;
  }

  async refreshAccessToken(refreshToken: string) {
    // แยก token เป็น 2 ส่วน
    const [tokenId, tokenSecret] = refreshToken.split('.');

    if (!tokenId || !tokenSecret) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    
    const token = await this.refreshTokenRepository.findOne({
      where: { tokenId, revoked: false },
      relations: ['user', 'user.organization'],
    });

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(tokenSecret, token.secretHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > token.expiresAt) {
      token.revoked = true;
      await this.refreshTokenRepository.save(token);
      throw new UnauthorizedException('Refresh token expired');
    }

    token.revoked = true;
    await this.refreshTokenRepository.save(token);
    const user = token.user;
    const newRefreshToken = await this.generateRefreshToken(
      user.id,
      token.deviceInfo ?? undefined,
    );
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

  async logout(refreshToken: string) {
    const [tokenId, tokenSecret] = refreshToken.split('.');

    if (!tokenId || !tokenSecret) {
      return { message: 'Logout สำเร็จ' };
    }

    const token = await this.refreshTokenRepository.findOne({
      where: { tokenId, revoked: false },
    });

    if (token) {
      
      const isValid = await bcrypt.compare(tokenSecret, token.secretHash);
      if (isValid) {
        token.revoked = true;
        await this.refreshTokenRepository.save(token);
      }
    }

    return { message: 'Logout สำเร็จ' };
  }

  async logoutAllDevices(userId: number) {
    await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );

    return { message: 'Logout จากทุกอุปกรณ์สำเร็จ' };
  }

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

  async cleanupExpiredTokens() {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .orWhere('revoked = :revoked', { revoked: true })
      .execute();

    return { deleted: result.affected };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findByIdWithOrg(userId);

    if (!user) {
      throw new UnauthorizedException('ไม่พบผู้ใช้');
    }

    const { password: _, ...result } = user;
    return result;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('ไม่พบผู้ใช้');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, { password: hashedPassword });
    await this.logoutAllDevices(userId);

    return { message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' };
  }
}