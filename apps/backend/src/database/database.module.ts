import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { appConfig } from "../config/app-config";
import {
  ApplicationSetting,
  AuditLog,
  CellChange,
  Device,
  DeviceEnrollmentToken,
  Job,
  MfaRecoveryCode,
  Notification,
  User,
  WorkbookEntity,
  Worksheet
} from "./entities";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      url: appConfig.databaseUrl,
      autoLoadEntities: true,
      synchronize: false,
      ssl: false,
      logging: appConfig.nodeEnv === "development" ? ["error", "warn"] : ["error"]
    }),
    TypeOrmModule.forFeature([
      ApplicationSetting,
      AuditLog,
      CellChange,
      Device,
      DeviceEnrollmentToken,
      Job,
      MfaRecoveryCode,
      Notification,
      User,
      WorkbookEntity,
      Worksheet
    ])
  ],
  exports: [TypeOrmModule]
})
export class DatabaseModule {}
