import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
