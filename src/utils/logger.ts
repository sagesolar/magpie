// Simple logger utility
/* eslint-disable no-console */
class Logger {
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  }

  info(message: string): void {
    console.log(this.formatMessage('info', message));
  }

  error(message: string, error?: Error | unknown): void {
    console.error(this.formatMessage('error', message));
    if (error) {
      console.error(error);
    }
  }

  warn(message: string): void {
    console.warn(this.formatMessage('warn', message));
  }

  debug(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('debug', message));
    }
  }
}

export const logger = new Logger();