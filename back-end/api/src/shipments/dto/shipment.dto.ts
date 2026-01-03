// src/shipments/dto/shipment.dto.ts
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateShipmentDto {
  @IsNumber()
  @IsNotEmpty()
  originWarehouseId: number;

  @IsNumber()
  @IsNotEmpty()
  destinationWarehouseId: number;

  @IsArray()
  @IsNotEmpty()
  tagUids: string[];  // รายการ Tag ที่จะส่ง

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  orgId?: number;
}

export class UpdateShipmentDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ShipmentQueryDto {
  @IsOptional()
  status?: string;

  @IsOptional()
  orgId?: number;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}