import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { parseEnvironment } from '@eventory/config';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import { AuthModule } from './common/auth/auth.module.js';
import { AuthGuard } from './common/auth/auth.guard.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { VenuesModule } from './modules/venues/venues.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { SeatingModule } from './modules/seating/seating.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => parseEnvironment()],
      validate: (config) => parseEnvironment(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.refreshToken',
          '*.qrSignature',
        ],
      },
    }),
    AuthModule,
    DatabaseModule,
    RedisModule,
    IdentityModule,
    OrganizationsModule,
    VenuesModule,
    EventsModule,
    SeatingModule,
    BookingsModule,
    OutboxModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
