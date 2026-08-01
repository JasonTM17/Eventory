import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketQrService } from './ticket-qr.service.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [TicketsController],
  providers: [TicketQrService, TicketsService],
  exports: [TicketQrService, TicketsService],
})
export class TicketsModule {}
