import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { CheckInController } from './check-in.controller.js';
import { CheckInService } from './check-in.service.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule, TicketsModule],
  controllers: [CheckInController],
  providers: [CheckInService],
})
export class CheckInModule {}
