// src/auth/auth.controller.ts
import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Req, 
  Res, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  Delete, 
  Param, 
  ParseIntPipe 
} from '@nestjs/common';
import type { Response, Request } from 'express'; 
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from './decorators';

// Config cookie
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ==================== LOGIN ====================
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceInfo = JSON.stringify({
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
    });

    const result = await this.authService.login(loginDto, deviceInfo);

    // Set Refresh Token เป็น HttpOnly Cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.refresh_token, COOKIE_OPTIONS);

    // Return Access Token + User (ไม่ส่ง refresh_token ใน body)
    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  // ==================== REFRESH TOKEN ====================
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      res.status(401);
      return { message: 'No refresh token' };
    }

    try {
      const result = await this.authService.refreshAccessToken(refreshToken);

      // Set Refresh Token ใหม่ (Token Rotation)
      res.cookie(REFRESH_TOKEN_COOKIE, result.refresh_token, COOKIE_OPTIONS);

      return {
        access_token: result.access_token,
        user: result.user,
      };
    } catch (error) {
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      throw error;
    }
  }

  // ==================== LOGOUT ====================
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return { message: 'Logout สำเร็จ' };
  }

  // ==================== LOGOUT ALL DEVICES ====================
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('userId') userId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAllDevices(userId);
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return { message: 'Logout จากทุกอุปกรณ์สำเร็จ' };
  }

  // ==================== GET PROFILE ====================
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser('userId') userId: number) {
    return this.authService.getProfile(userId);
  }

  // ==================== GET ACTIVE SESSIONS ====================
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@CurrentUser('userId') userId: number) {
    return this.authService.getActiveSessions(userId);
  }

  // ==================== REVOKE SESSION ====================
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) sessionId: number,
  ) {
    return this.authService.revokeSession(userId, sessionId);
  }

  // ==================== CHANGE PASSWORD ====================
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('userId') userId: number,
    @Body() body: { currentPassword: string; newPassword: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );

    // ลบ cookie (บังคับ login ใหม่)
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return result;
  }
}