import { existsSync, readFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import session from "express-session";
import { appConfig } from "./config/app-config";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { NoStoreInterceptor } from "./common/no-store.interceptor";
import { AppModule } from "./app.module";
import { RedisService } from "./security/redis.service";
import { RedisSessionStore } from "./security/redis-session.store";
import { JsonLogger } from "./common/logger";

function readSecret(path: string): string {
  if (existsSync(path)) {
    return readFileSync(path, "utf8").trim();
  }
  if (appConfig.isProduction) {
    throw new Error(`Missing secret file: ${path}`);
  }
  return "development-only-session-secret-change-me";
}

function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void {
  if (!origin || appConfig.frontendOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
}

async function bootstrap(): Promise<void> {
  const logger = new JsonLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  if (appConfig.trustProxy) {
    app.set("trust proxy", 1);
  }
  app.setGlobalPrefix("api");
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "no-referrer" }
  }));
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Dev-Device-Fingerprint", "X-Workspace-Token"]
  });
  const redis = app.get(RedisService);
  const redisReady = await redis.ping();
  const store = redisReady ? new RedisSessionStore(redis.raw) : undefined;
  app.use(session({
    name: "ssw.sid",
    secret: readSecret(appConfig.sessionSecretFile),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store,
    cookie: {
      httpOnly: true,
      secure: appConfig.isProduction,
      sameSite: appConfig.sessionCookieSameSite,
      maxAge: appConfig.sessionIdleTimeoutMinutes * 60_000
    }
  }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new NoStoreInterceptor());
  await app.listen(appConfig.port, appConfig.host);
  logger.log("info", "backend_started", { event: "STARTUP", host: appConfig.host, port: appConfig.port });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "STARTUP_FAILED", message }) + "\n");
  process.exit(1);
});
