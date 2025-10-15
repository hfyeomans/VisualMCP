import path from 'path';

import fs from 'fs-extra';

import { config } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  error?: Error;
}

/**
 * Structured logger with configurable levels and optional file output
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private enableFileLogging: boolean;
  private logFile: string;

  private constructor() {
    const loggingConfig = config.loggingConfig;
    this.logLevel = loggingConfig.level;
    this.enableFileLogging = loggingConfig.enableFileLogging;
    this.logFile = loggingConfig.logFile;

    if (this.enableFileLogging) {
      this.ensureLogDirectory();
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      const logDir = path.dirname(this.logFile);
      await fs.ensureDir(logDir);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create log directory:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component.padEnd(15);
    let message = `[${timestamp}] ${level} ${component} ${entry.message}`;

    if (entry.data) {
      message += ` | Data: ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      message += ` | Error: ${entry.error.message}`;
      if (entry.error.stack && entry.level === 'error') {
        message += `\n${entry.error.stack}`;
      }
    }

    return message;
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.enableFileLogging) return;

    try {
      const message = this.formatMessage(entry) + '\n';
      await fs.appendFile(this.logFile, message);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to write to log file:', error);
    }
  }

  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      error
    };

    const formattedMessage = this.formatMessage(entry);

    // Console output with colors - ALL LOGS GO TO STDERR (MCP protocol uses stdout)
    /* eslint-disable no-console */
    switch (level) {
      case 'debug':
        console.error(`\x1b[36m${formattedMessage}\x1b[0m`); // Cyan
        break;
      case 'info':
        console.error(`\x1b[32m${formattedMessage}\x1b[0m`); // Green
        break;
      case 'warn':
        console.warn(`\x1b[33m${formattedMessage}\x1b[0m`); // Yellow
        break;
      case 'error':
        console.error(`\x1b[31m${formattedMessage}\x1b[0m`); // Red
        break;
    }
    /* eslint-enable no-console */

    // File output (async, don't wait)
    this.writeToFile(entry).catch(() => {
      // Silently ignore file write errors to prevent logging loops
    });
  }

  public debug(component: string, message: string, data?: unknown): void {
    this.log('debug', component, message, data);
  }

  public info(component: string, message: string, data?: unknown): void {
    this.log('info', component, message, data);
  }

  public warn(component: string, message: string, data?: unknown, error?: Error): void {
    this.log('warn', component, message, data, error);
  }

  public error(component: string, message: string, error?: Error, data?: unknown): void {
    this.log('error', component, message, data, error);
  }

  // Component-specific loggers
  public createComponentLogger(component: string) {
    return {
      debug: (message: string, data?: unknown) => this.debug(component, message, data),
      info: (message: string, data?: unknown) => this.info(component, message, data),
      warn: (message: string, data?: unknown, error?: Error) =>
        this.warn(component, message, data, error),
      error: (message: string, error?: Error, data?: unknown) =>
        this.error(component, message, error, data)
    };
  }
}

// Export singleton instance and component logger factory
export const logger = Logger.getInstance();
export const createLogger = (component: string) => logger.createComponentLogger(component);
