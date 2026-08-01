import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { EventsController, OrganizerEventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [EventsController, OrganizerEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
