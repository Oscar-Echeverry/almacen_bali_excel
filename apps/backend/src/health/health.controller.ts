import { Controller, Get } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "../security/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService
  ) {}

  @Get()
  async health(): Promise<{ status: string; database: string; redis: string }> {
    let database = "down";
    let redis = "down";
    try {
      await this.dataSource.query("SELECT 1");
      database = "up";
    } catch {
      database = "down";
    }
    try {
      redis = await this.redis.ping() ? "up" : "down";
    } catch {
      redis = "down";
    }
    return {
      status: database === "up" && redis === "up" ? "ok" : "degraded",
      database,
      redis
    };
  }
}
