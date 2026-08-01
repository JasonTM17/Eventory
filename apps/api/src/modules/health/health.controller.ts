import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { Public } from '../../common/auth/auth.decorators.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  live(): { status: 'ok'; checks: { process: 'up' } } {
    return { status: 'ok', checks: { process: 'up' } };
  }

  @Get('live')
  liveProbe(): { status: 'ok'; checks: { process: 'up' } } {
    return this.live();
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; checks: { database: 'up'; redis: 'up' } }> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.redis.ping()]);
    if (!database || !redis) {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'One or more dependencies are unavailable',
        details: { database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' },
      });
    }

    return { status: 'ok', checks: { database: 'up', redis: 'up' } };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
