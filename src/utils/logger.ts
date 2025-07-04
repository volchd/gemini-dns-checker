export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  domain?: string;
  endpoint?: string;
  requestId?: string;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${this.safeJsonStringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  private safeJsonStringify(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      // Handle circular references and other JSON errors
      try {
        return JSON.stringify(obj, (key, value) => {
          if (value === null || value === undefined) {
            return null;
          }
          if (typeof value === 'object') {
            // Simple circular reference detection
            if (this.stringifyCache && this.stringifyCache.has(value)) {
              return '[Circular]';
            }
            if (!this.stringifyCache) {
              this.stringifyCache = new WeakSet();
            }
            this.stringifyCache.add(value);
          }
          return value;
        });
      } catch (fallbackError) {
        return '[Object - Unable to serialize]';
      } finally {
        this.stringifyCache = undefined;
      }
    }
  }

  private stringifyCache?: WeakSet<object>;

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorDetails = error ? ` | Error: ${error.message} | Stack: ${error.stack}` : '';
      console.error(this.formatMessage(LogLevel.ERROR, message + errorDetails, context));
    }
  }
}

export const logger = Logger.getInstance(); 