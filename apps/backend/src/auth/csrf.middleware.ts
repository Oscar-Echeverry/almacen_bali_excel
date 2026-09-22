import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { appConfig } from "../config/app-config";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PATH_SUFFIXES = ["/auth/csrf", "/auth/login", "/health", "/enrollment/submit"];

function pathWithoutQuery(value: string | undefined): string {
  return value?.split("?")[0] ?? "";
}

function isExemptPath(req: Request): boolean {
  const paths = [
    pathWithoutQuery(req.path),
    pathWithoutQuery(req.url),
    pathWithoutQuery(req.originalUrl)
  ];
  return paths.some((path) => EXEMPT_PATH_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix)));
}

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method) || isExemptPath(req)) {
    next();
    return;
  }
  if (!req.session.csrfSecret && !appConfig.isProduction) {
    next();
    return;
  }
  const header = req.header("X-CSRF-Token");
  if (!header || !req.session.csrfSecret) {
    res.status(403).json({ code: "AUTH_INVALID", message: "CSRF token requerido.", requestId: req.requestId ?? "unknown" });
    return;
  }
  const expected = Buffer.from(req.session.csrfSecret);
  const received = Buffer.from(header);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    res.status(403).json({ code: "AUTH_INVALID", message: "CSRF token inválido.", requestId: req.requestId ?? "unknown" });
    return;
  }
  next();
}
