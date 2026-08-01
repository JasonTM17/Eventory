import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly subscriber: Redis;
  private readonly expirationListeners = new Set<(key: string) => void>();

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
    this.subscriber = this.client.duplicate();
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
    this.subscriber.on('error', (error: Error) => {
      this.logger.warn(`Redis expiration subscriber error: ${error.message}`);
    });
    this.subscriber.on('pmessage', (_pattern, _channel, key: string) => {
      for (const listener of this.expirationListeners) listener(key);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
      await this.subscriber.config('SET', 'notify-keyspace-events', 'Ex');
      await this.subscriber.psubscribe('__keyevent@*__:expired');
    } catch (error) {
      this.logger.warn(
        `Redis is unavailable during startup: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    if (!keys.length) return [];
    return this.client.mget(keys);
  }

  async setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    await this.client.set(key, value, 'PX', ttlMs);
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async count(pattern: string): Promise<number> {
    if (this.client.status === 'wait') await this.client.connect();
    let cursor = '0';
    let total = 0;
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = nextCursor;
      total += keys.length;
    } while (cursor !== '0');
    return total;
  }

  async evaluate(script: string, keys: string[], args: string[] = []): Promise<number> {
    return Number(await this.client.eval(script, keys.length, ...keys, ...args));
  }

  onExpired(listener: (key: string) => void): () => void {
    this.expirationListeners.add(listener);
    return () => this.expirationListeners.delete(listener);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber.status !== 'end') await this.subscriber.quit();
    if (this.client.status !== 'end') await this.client.quit();
  }
}
