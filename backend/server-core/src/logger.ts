import { type Logger, pino } from "pino";

export type { Logger };

/** Fields that must never reach logs. */
const REDACT = [
  "password",
  "*.password",
  "currentPassword",
  "newPassword",
  "token",
  "*.token",
  "ticket",
  "code",
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

export function createLogger(options: { level?: string; name: string; pretty?: boolean }): Logger {
  return pino({
    name: options.name,
    level: options.level ?? "info",
    redact: { paths: REDACT, censor: "[redacted]" },
    ...(options.pretty
      ? { transport: { target: "pino-pretty", options: { colorize: true, singleLine: true } } }
      : {}),
  });
}
