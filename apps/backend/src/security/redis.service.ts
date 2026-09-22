import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { appConfig } from "../config/app-config";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(appConfig.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      connectTimeout: 1_000,
      retryStrategy: () => null
    });
    this.client.on("error", () => undefined);
  }

  get raw(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      if (this.client.status === "wait") {
        await this.withTimeout(this.client.connect(), 1_000);
      }
      return (await this.withTimeout(this.client.ping(), 1_000)) === "PONG";
    } catch {
      if (appConfig.isProduction) {
        throw new Error("Redis is unavailable");
      }
      this.client.disconnect(false);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Redis operation timed out")), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
