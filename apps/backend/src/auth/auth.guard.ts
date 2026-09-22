import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@secure-spreadsheet/shared";
import type { Request } from "express";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ErrorCodeException } from "../common/error-code.exception";
import { User } from "../database/entities";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly users: Repository<User>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session.userId || !req.session.role) {
      throw new ErrorCodeException("AUTH_INVALID", "Sesión inválida.", HttpStatus.UNAUTHORIZED);
    }

    const user = await this.users.findOne({
      where: { id: req.session.userId },
      select: { id: true, active: true, activeSessionId: true }
    });
    if (!user?.active || user.activeSessionId !== req.sessionID) {
      throw new ErrorCodeException("AUTH_INVALID", "Sesión cerrada porque la cuenta se abrió en otra pestaña o navegador.", HttpStatus.UNAUTHORIZED);
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (roles && !roles.includes(req.session.role)) {
      throw new ErrorCodeException("UNAUTHORIZED_ACCESS", "No autorizado.", HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
