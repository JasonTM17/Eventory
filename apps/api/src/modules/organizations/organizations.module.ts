import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module.js';
import { OrganizationMemberGuard } from '../../common/auth/organization-member.guard.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, AuditModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMemberGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
