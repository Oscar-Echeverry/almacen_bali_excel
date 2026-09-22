import { Injectable } from "@nestjs/common";
import { RedisService } from "./redis.service";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

@Injectable()
export class RateLimitService {
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly redis: RedisService) {}

  async consume(key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisReady = await this.redis.ping();
    if (!redisReady) {
      return this.consumeMemory(key, max, windowSeconds);
    }
    const redisKey = `rate:${key}`;
    const count = await this.redis.raw.incr(redisKey);
    if (count === 1) {
      await this.redis.raw.expire(redisKey, windowSeconds);
    }
    const ttl = await this.redis.raw.ttl(redisKey);
    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      resetSeconds: ttl > 0 ? ttl : windowSeconds
    };
  }

  private consumeMemory(key: string, max: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: max - 1, resetSeconds: windowSeconds };
    }
    entry.count += 1;
    return {
      allowed: entry.count <= max,
      remaining: Math.max(0, max - entry.count),
      resetSeconds: Math.ceil((entry.expiresAt - now) / 1000)
    };
  }
}
