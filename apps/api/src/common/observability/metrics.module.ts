import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { OutboxModule } from '../../modules/outbox/outbox.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { MetricsService } from './metrics.service.js';

@Module({
  imports: [DatabaseModule, RedisModule, OutboxModule],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsInterceptor],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
