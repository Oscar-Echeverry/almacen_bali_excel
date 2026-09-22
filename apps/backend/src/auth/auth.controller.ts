import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { randomBytes } from "node:crypto";
import { AuthGuard } from "./auth.guard";
import { AuthService, LoginResult } from "./auth.service";
import { LoginDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("csrf")
  csrf(@Req() req: Request): { csrfToken: string } {
    const token = randomBytes(32).toString("base64url");
    req.session.csrfSecret = token;
    return { csrfToken: token };
  }

  @Post("login")
  login(@Req() req: Request, @Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(req, dto);
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  async logout(@Req() req: Request): Promise<{ ok: true }> {
    await this.auth.logout(req);
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@Req() req: Request): { id: string; role: string; sessionPublicId: string; deviceId: string | null } {
    return {
      id: req.session.userId ?? "",
      role: req.session.role ?? "",
      sessionPublicId: req.session.sessionPublicId ?? "",
      deviceId: req.session.deviceId ?? null
    };
  }
}
