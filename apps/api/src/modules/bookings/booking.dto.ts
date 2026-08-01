import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  eventSessionId!: string;

  @IsUUID('4', { each: true })
  seatIds!: string[];

  @IsString()
  @Min(32)
  @Max(160)
  holdToken!: string;

  @IsOptional()
  @IsString()
  @Max(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  clientTotalMinor?: number;
}
