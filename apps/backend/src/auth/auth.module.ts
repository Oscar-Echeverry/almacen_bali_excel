import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Device, MfaRecoveryCode, User } from "../database/entities";
import { SecurityModule } from "../security/security.module";
import { MfaService } from "../mfa/mfa.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [TypeOrmModule.forFeature([User, Device, MfaRecoveryCode]), SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, MfaService],
  exports: [AuthService, AuthGuard, MfaService]
})
export class AuthModule {}
