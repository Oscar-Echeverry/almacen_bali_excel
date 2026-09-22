import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorCode } from "@secure-spreadsheet/shared";

export class ErrorCodeException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super({ code, message }, status);
  }
}
