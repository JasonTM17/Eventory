import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import {
  EventStatus,
  PaymentReconciliationStatus,
  UserStatus,
} from '../../generated/prisma/client.js';

export class AdminPageQueryDto {
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

export class AdminEventQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}

export class PaymentReconciliationQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsEnum(PaymentReconciliationStatus)
  status?: PaymentReconciliationStatus;
}

export class ResolvePaymentReconciliationDto {
  @IsString()
  @Length(8, 500)
  resolution!: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
