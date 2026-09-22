import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import type { ApiErrorBody } from "@secure-spreadsheet/shared";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody = typeof raw === "object" && raw !== null ? raw as Partial<ApiErrorBody> : {};
    const body: ApiErrorBody = {
      code: responseBody.code ?? "AUTH_INVALID",
      message: status === HttpStatus.INTERNAL_SERVER_ERROR ? "Error interno." : responseBody.message ?? "Solicitud inválida.",
      requestId: request.requestId ?? "unknown"
    };
    response.status(status).json(body);
  }
}
