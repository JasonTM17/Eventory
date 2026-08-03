import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  eventSessionId!: string;

  @IsUUID('4', { each: true })
  seatIds!: string[];

  @IsString()
  @Length(32, 160)
  holdToken!: string;

  @IsOptional()
  @IsString()
  @Length(32, 128)
  idempotencyKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  clientTotalMinor?: number;
}
