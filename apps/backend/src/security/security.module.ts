import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog, ApplicationSetting, Notification } from "../database/entities";
import { AuditService } from "../audit/audit.service";
import { CryptoService } from "./crypto.service";
import { RateLimitService } from "./rate-limit.service";
import { RedisService } from "./redis.service";
import { SettingsService } from "./settings.service";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, ApplicationSetting, Notification])],
  providers: [AuditService, CryptoService, RateLimitService, RedisService, SettingsService],
  exports: [AuditService, CryptoService, RateLimitService, RedisService, SettingsService]
})
export class SecurityModule {}
