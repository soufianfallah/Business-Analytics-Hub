type LogLevel = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const configuredLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

function write(level: LogLevel, message: string, context: Context = {}) {
  if (priorities[level] < priorities[configuredLevel]) return;
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const logger = {
  debug: (message: string, context?: Context) =>
    write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  error: (message: string, error?: unknown, context: Context = {}) =>
    write("error", message, {
      ...context,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    }),
};
