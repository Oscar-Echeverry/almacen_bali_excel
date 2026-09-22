import "reflect-metadata";
import { DataSource } from "typeorm";
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

export const AppDataSource = new DataSource({
  type: "postgres",
  url: appConfig.databaseUrl,
  entities: [
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
  ],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
  ssl: false,
  logging: appConfig.nodeEnv === "development" ? ["error", "warn"] : ["error"]
});
