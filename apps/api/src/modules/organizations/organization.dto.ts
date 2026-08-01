import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { OrganizationMemberRole } from '../../generated/prisma/client.js';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;
}

export class AddOrganizationMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(OrganizationMemberRole)
  role!: OrganizationMemberRole;
}
