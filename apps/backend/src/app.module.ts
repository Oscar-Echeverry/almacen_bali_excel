import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { csrfMiddleware } from "./auth/csrf.middleware";
import { requestIdMiddleware } from "./common/request-id.middleware";
import { DatabaseModule } from "./database/database.module";
import { DevicesModule } from "./devices/devices.module";
import { ExcelModule } from "./excel/excel.module";
import { HealthModule } from "./health/health.module";
import { SecurityModule } from "./security/security.module";
import { DashboardController } from "./security/dashboard.controller";
import { SecurityEventsController } from "./security/security-events.controller";
import { UsersModule } from "./users/users.module";
import { User } from "./database/entities";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
    SecurityModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    ExcelModule,
    HealthModule
  ],
  controllers: [SecurityEventsController, DashboardController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes("*");
    consumer.apply(csrfMiddleware).forRoutes("*");
  }
}
