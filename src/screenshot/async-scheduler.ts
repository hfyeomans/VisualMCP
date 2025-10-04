import { createLogger } from '../core/logger.js';

const logger = createLogger('AsyncScheduler');

export interface SchedulerOptions {
  intervalMs: number;
  maxJitter?: number; // Maximum jitter in ms (randomness to prevent thundering herd)
  backoffMultiplier?: number; // Backoff multiplier on errors (default: 1.5)
  maxBackoffMs?: number; // Maximum backoff interval (default: 60000)
}

/**
 * Async task scheduler that ensures no overlapping executions
 * Replaces setInterval with a queued async runner
 */
export class AsyncScheduler {
  private isRunning = false;
  private isStopped = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private currentBackoffMs: number;
  private consecutiveErrors = 0;

  constructor(
    private readonly task: () => Promise<void>,
    private readonly options: SchedulerOptions
  ) {
    this.currentBackoffMs = options.intervalMs;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running, ignoring start request');
      return;
    }

    this.isStopped = false;
    this.isRunning = true;
    this.consecutiveErrors = 0;
    this.currentBackoffMs = this.options.intervalMs;

    logger.debug('Scheduler started', {
      intervalMs: this.options.intervalMs,
      maxJitter: this.options.maxJitter
    });

    // Schedule first run
    this.scheduleNext();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isStopped = true;
    this.isRunning = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    logger.debug('Scheduler stopped');
  }

  /**
   * Check if scheduler is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Schedule the next task execution
   */
  private scheduleNext(): void {
    if (this.isStopped) {
      return;
    }

    // Calculate delay with optional jitter
    let delay = this.currentBackoffMs;
    if (this.options.maxJitter && this.options.maxJitter > 0) {
      const jitter = Math.random() * this.options.maxJitter;
      delay += jitter;
    }

    logger.debug('Scheduling next run', { delayMs: Math.round(delay) });

    this.timeoutId = setTimeout(() => {
      void this.runTask();
    }, delay);
  }

  /**
   * Execute the task and handle errors/backoff
   */
  private async runTask(): Promise<void> {
    if (this.isStopped) {
      return;
    }

    try {
      logger.debug('Executing scheduled task');
      await this.task();

      // Reset backoff on success
      this.consecutiveErrors = 0;
      this.currentBackoffMs = this.options.intervalMs;

      logger.debug('Task completed successfully');
    } catch (error) {
      this.consecutiveErrors++;
      logger.error('Scheduled task failed', error as Error, {
        consecutiveErrors: this.consecutiveErrors
      });

      // Apply exponential backoff
      if (this.options.backoffMultiplier && this.consecutiveErrors > 0) {
        const backoffMultiplier = this.options.backoffMultiplier || 1.5;
        const maxBackoff = this.options.maxBackoffMs || 60000;

        this.currentBackoffMs = Math.min(
          this.options.intervalMs * Math.pow(backoffMultiplier, this.consecutiveErrors),
          maxBackoff
        );

        logger.debug('Applying exponential backoff', {
          consecutiveErrors: this.consecutiveErrors,
          newBackoffMs: this.currentBackoffMs
        });
      }
    }

    // Schedule next run
    this.scheduleNext();
  }
}
