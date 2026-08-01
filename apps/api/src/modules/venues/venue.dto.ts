import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateVenueDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class CreateVenueSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateSeatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  rowLabel!: string;

  @IsInt()
  @Min(1)
  seatNumber!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;
}
