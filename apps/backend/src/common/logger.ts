export interface LogContext {
  requestId?: string;
  userId?: string;
  deviceId?: string;
  event?: string;
  [key: string]: string | number | boolean | undefined;
}

export class JsonLogger {
  log(level: "info" | "warn" | "error", message: string, context: LogContext = {}): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}
