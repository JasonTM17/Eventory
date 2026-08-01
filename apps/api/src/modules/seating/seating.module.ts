import { Module } from '@nestjs/common';
import { SeatingController } from './seating.controller.js';
import { SeatingGateway } from './seating.gateway.js';
import { SeatingService } from './seating.service.js';

@Module({
  controllers: [SeatingController],
  providers: [SeatingGateway, SeatingService],
  exports: [SeatingService],
})
export class SeatingModule {}
