import { createLogger } from '../core/logger.js';
import { IFeedbackAnalyzer } from '../interfaces/index.js';

const logger = createLogger('AutoFeedbackManager');

export interface AutoFeedbackOptions {
  enabled: boolean;
  rateLimitMs: number; // Minimum time between feedback analyses
  maxConcurrent: number; // Maximum concurrent feedback analyses
}

/**
 * Manages automatic feedback generation with rate limiting
 */
export class AutoFeedbackManager {
  private lastFeedbackTime = new Map<string, number>();
  private activeFeedback = new Set<string>();
  private feedbackQueue: Array<{
    sessionId: string;
    diffImagePath: string;
    timestamp: number;
  }> = [];

  constructor(
    private readonly feedbackAnalyzer: IFeedbackAnalyzer,
    private readonly options: AutoFeedbackOptions
  ) {}

  /**
   * Trigger feedback analysis for a monitoring session
   * Returns true if feedback was triggered, false if rate-limited
   */
  async triggerFeedback(sessionId: string, diffImagePath: string): Promise<boolean> {
    if (!this.options.enabled) {
      logger.debug('Auto-feedback disabled', { sessionId });
      return false;
    }

    const now = Date.now();
    const lastTime = this.lastFeedbackTime.get(sessionId) || 0;
    const timeSinceLastFeedback = now - lastTime;

    // Check rate limit
    if (timeSinceLastFeedback < this.options.rateLimitMs) {
      logger.debug('Feedback rate-limited', {
        sessionId,
        timeSinceLastMs: timeSinceLastFeedback,
        rateLimitMs: this.options.rateLimitMs
      });
      return false;
    }

    // Check concurrent limit
    if (this.activeFeedback.size >= this.options.maxConcurrent) {
      logger.debug('Max concurrent feedback analyses reached, queueing', {
        sessionId,
        activeFeedback: this.activeFeedback.size
      });

      this.feedbackQueue.push({ sessionId, diffImagePath, timestamp: now });
      return false;
    }

    // Execute feedback analysis
    await this.executeFeedback(sessionId, diffImagePath);
    return true;
  }

  /**
   * Execute feedback analysis
   */
  private async executeFeedback(sessionId: string, diffImagePath: string): Promise<void> {
    this.activeFeedback.add(sessionId);
    this.lastFeedbackTime.set(sessionId, Date.now());

    logger.info('Executing auto-feedback analysis', { sessionId, diffImagePath });

    try {
      const result = await this.feedbackAnalyzer.analyzeDifferences(diffImagePath, {
        priority: ['layout', 'colors'],
        suggestionsType: 'both'
      });

      logger.info('Auto-feedback completed', {
        sessionId,
        issuesCount: result.issues.length,
        suggestionsCount: result.suggestions.length,
        confidence: result.confidence
      });
    } catch (error) {
      logger.error('Auto-feedback failed', error as Error, { sessionId, diffImagePath });
    } finally {
      this.activeFeedback.delete(sessionId);

      // Process queue
      this.processQueue();
    }
  }

  /**
   * Process queued feedback requests
   */
  private processQueue(): void {
    if (this.feedbackQueue.length === 0) {
      return;
    }

    // Check if we can process more
    if (this.activeFeedback.size >= this.options.maxConcurrent) {
      return;
    }

    // Get next item from queue
    const next = this.feedbackQueue.shift();
    if (!next) {
      return;
    }

    const now = Date.now();
    const lastTime = this.lastFeedbackTime.get(next.sessionId) || 0;
    const timeSinceLastFeedback = now - lastTime;

    // Check if still rate-limited
    if (timeSinceLastFeedback < this.options.rateLimitMs) {
      logger.debug('Queued item still rate-limited, re-queuing', { sessionId: next.sessionId });
      this.feedbackQueue.push(next);
      return;
    }

    // Execute
    void this.executeFeedback(next.sessionId, next.diffImagePath);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.feedbackQueue.length;
  }

  /**
   * Get active feedback count
   */
  getActiveFeedbackCount(): number {
    return this.activeFeedback.size;
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.lastFeedbackTime.clear();
    this.activeFeedback.clear();
    this.feedbackQueue = [];
  }
}
