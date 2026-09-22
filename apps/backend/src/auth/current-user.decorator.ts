import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface CurrentUser {
  id: string;
  role: "ADMIN" | "EMPLOYEE";
  deviceId: string | null;
  sessionPublicId: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUser => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.session.userId || !req.session.role || !req.session.sessionPublicId) {
    throw new Error("CurrentUser requested without an authenticated session");
  }
  return {
    id: req.session.userId,
    role: req.session.role,
    deviceId: req.session.deviceId ?? null,
    sessionPublicId: req.session.sessionPublicId
  };
});
