import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, AuditModule, UsersModule],
  controllers: [IdentityController],
  providers: [IdentityService],
})
export class IdentityModule {}
