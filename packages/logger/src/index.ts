import pino, { type Logger } from "pino";
import os from "os";

export type AppLogger = Logger;

interface LoggerContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
}

export function createLogger(name: string, context?: LoggerContext): AppLogger {
  const isProduction = process.env.NODE_ENV === "production";

  const base = {
    pid: process.pid,
    hostname: os.hostname(),
    name,
    ...context,
  };

  if (isProduction) {
    return pino({
      level: process.env.LOG_LEVEL ?? "info",
      base,
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  return pino(
    {
      level: process.env.LOG_LEVEL ?? "debug",
      base,
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    },
  );
}

export function withContext(
  logger: AppLogger,
  context: LoggerContext,
): AppLogger {
  return logger.child(context);
}
