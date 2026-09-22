import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DeviceSecurityMode = "development" | "mtls" | "browser";
export type SessionCookieSameSite = "strict" | "lax" | "none";

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  appUrl: string;
  apiUrl: string;
  frontendOrigin: string;
  frontendOrigins: string[];
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  sessionSecretFile: string;
  masterEncryptionKeyFile: string;
  auditHmacKeyFile: string;
  deviceCaKeyFile: string;
  deviceCaCertFile: string;
  deviceSecurityMode: DeviceSecurityMode;
  storageDir: string;
  tmpDir: string;
  maxUploadMb: number;
  maxRowsPerRequest: number;
  sessionIdleTimeoutMinutes: number;
  singleSessionPerUser: boolean;
  totpIssuer: string;
  auditIncludeCellValues: boolean;
  loginMaxAttempts: number;
  loginLockMinutes: number;
  enrollmentTokenTtlMinutes: number;
  sessionCookieSameSite: SessionCookieSameSite;
  trustProxy: boolean;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberValue(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return raw === "true";
}

function csvValue(name: string): string[] {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sameSiteValue(name: string, fallback: SessionCookieSameSite): SessionCookieSameSite {
  const raw = (process.env[name] ?? fallback).toLowerCase();
  if (!["strict", "lax", "none"].includes(raw)) {
    throw new Error(`${name} must be one of: strict, lax, none`);
  }
  return raw as SessionCookieSameSite;
}

export function loadAppConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const deviceSecurityMode = (process.env.DEVICE_SECURITY_MODE ?? "development") as DeviceSecurityMode;
  if (!["development", "mtls", "browser"].includes(deviceSecurityMode)) {
    throw new Error("DEVICE_SECURITY_MODE must be one of: development, mtls, browser");
  }
  if (isProduction && deviceSecurityMode === "development") {
    throw new Error("Refusing to start production with DEVICE_SECURITY_MODE=development");
  }
  const frontendOrigin = normalizeOrigin(required("FRONTEND_ORIGIN", "http://localhost:5173"));
  const frontendOrigins = uniqueValues([frontendOrigin, ...csvValue("FRONTEND_ORIGINS").map(normalizeOrigin)]);

  const config: AppConfig = {
    nodeEnv,
    isProduction,
    appUrl: required("APP_URL", "http://localhost:5173"),
    apiUrl: required("API_URL", "http://localhost:3000/api"),
    frontendOrigin,
    frontendOrigins,
    host: required("HOST", "127.0.0.1"),
    port: numberValue("PORT", 3000),
    databaseUrl: required("DATABASE_URL", "postgres://secure_spreadsheet:secure_spreadsheet@127.0.0.1:5432/secure_spreadsheet"),
    redisUrl: required("REDIS_URL", "redis://127.0.0.1:6379"),
    sessionSecretFile: required("SESSION_SECRET_FILE", join(process.cwd(), "secrets", "session.key")),
    masterEncryptionKeyFile: required("MASTER_ENCRYPTION_KEY_FILE", join(process.cwd(), "secrets", "master.key")),
    auditHmacKeyFile: required("AUDIT_HMAC_KEY_FILE", join(process.cwd(), "secrets", "audit-hmac.key")),
    deviceCaKeyFile: required("DEVICE_CA_KEY_FILE", join(process.cwd(), "secrets", "device-ca.key")),
    deviceCaCertFile: required("DEVICE_CA_CERT_FILE", join(process.cwd(), "secrets", "device-ca.crt")),
    deviceSecurityMode,
    storageDir: required("STORAGE_DIR", join(process.cwd(), "storage")),
    tmpDir: required("TMP_DIR", join(process.cwd(), "tmp")),
    maxUploadMb: numberValue("MAX_UPLOAD_MB", 50),
    maxRowsPerRequest: numberValue("MAX_ROWS_PER_REQUEST", 500),
    sessionIdleTimeoutMinutes: numberValue("SESSION_IDLE_TIMEOUT_MINUTES", 15),
    singleSessionPerUser: booleanValue("SINGLE_SESSION_PER_USER", true),
    totpIssuer: required("TOTP_ISSUER", "Secure Spreadsheet Workspace"),
    auditIncludeCellValues: booleanValue("AUDIT_INCLUDE_CELL_VALUES", false),
    loginMaxAttempts: numberValue("LOGIN_MAX_ATTEMPTS", 5),
    loginLockMinutes: numberValue("LOGIN_LOCK_MINUTES", 15),
    enrollmentTokenTtlMinutes: numberValue("ENROLLMENT_TOKEN_TTL_MINUTES", 15),
    sessionCookieSameSite: sameSiteValue("SESSION_COOKIE_SAME_SITE", isProduction ? "none" : "lax"),
    trustProxy: booleanValue("TRUST_PROXY", isProduction)
  };

  if (config.isProduction) {
    assertProductionFiles(config);
  }

  return config;
}

function assertProductionFiles(config: AppConfig): void {
  const requiredFiles = [
    config.sessionSecretFile,
    config.masterEncryptionKeyFile,
    config.auditHmacKeyFile
  ];
  if (config.deviceSecurityMode === "mtls") {
    requiredFiles.push(config.deviceCaCertFile, config.deviceCaKeyFile);
  }
  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      throw new Error(`Missing required production secret file: ${file}`);
    }
  }
  const masterKey = readFileSync(config.masterEncryptionKeyFile);
  if (masterKey.length < 32) {
    throw new Error("MASTER_ENCRYPTION_KEY_FILE must contain at least 32 bytes");
  }
}

export const appConfig = loadAppConfig();
