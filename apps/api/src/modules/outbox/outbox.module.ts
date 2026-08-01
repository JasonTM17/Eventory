import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { EmailService } from './email.service.js';
import { OutboxService } from './outbox.service.js';
import { OutboxWorker } from './outbox.worker.js';

@Module({
  imports: [DatabaseModule],
  providers: [EmailService, OutboxService, OutboxWorker],
  exports: [EmailService, OutboxService],
})
export class OutboxModule {}
