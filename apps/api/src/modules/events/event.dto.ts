import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;
}

export class CreateSessionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsDateString()
  salesStartAt!: string;

  @IsDateString()
  salesEndAt!: string;
}

export class CreateTicketTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity!: number;
}

export class EventListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
