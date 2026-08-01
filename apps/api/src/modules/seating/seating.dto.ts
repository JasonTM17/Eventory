import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class HoldSeatsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @IsUUID('4', { each: true })
  seatIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class ReleaseSeatsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @IsUUID('4', { each: true })
  seatIds!: string[];

  @IsString()
  @MaxLength(160)
  holdToken!: string;
}

export class RenewSeatsDto extends ReleaseSeatsDto {}
