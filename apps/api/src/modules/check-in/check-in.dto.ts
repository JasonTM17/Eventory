import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CheckInDto {
  @IsString()
  @Length(20, 512)
  qrPayload!: string;

  @IsOptional()
  @IsUUID()
  eventSessionId?: string;
}
