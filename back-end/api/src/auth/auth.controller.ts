// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  //LOGIN
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() LoginDto: LoginDto){
    return this.authService.login(LoginDto);
  }

  // ดึงงข้อมูล profile ตัวเอง
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser('userId') userId:number){
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('userId') userId: number,
    @Body() body: { currentPassword: string; newPassword: string},
  ){
    console.log("=== CONTROLLER DEBUG ===");
    console.log('userId from token', userId);
    console.log('body', body);
    return this.authService.changePassword(userId, body.currentPassword, body.newPassword);
  }

}