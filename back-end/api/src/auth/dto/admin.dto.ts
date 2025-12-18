import { IsNotEmpty, IsString, IsEmail, IsOptional, IsNumber, IsEnum, MinLength, IsBoolean } from 'class-validator';

// User Role Enum
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

// ==================== Organization DTOs ====================

export class CreateOrganizationDto {
  @IsNotEmpty({ message: 'กรุณากรอกชื่อบริษัท' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'กรุณากรอกรหัสบริษัท' })
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==================== User DTOs ====================

export class CreateUserDto {
  @IsNotEmpty({ message: 'กรุณากรอก Username' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'กรุณากรอกอีเมล' })
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email: string;

  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่าน' })
  @IsString()
  @MinLength(6, { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
  password: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsNotEmpty({ message: 'กรุณาเลือกบริษัท' })
  @IsNumber()
  organizationId: number;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsNumber()
  organizationId?: number;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่านใหม่' })
  @IsString()
  @MinLength(6, { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
  newPassword: string;
}