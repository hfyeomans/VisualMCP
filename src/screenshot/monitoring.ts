import { EventEmitter } from 'events';
import path from 'path';

import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

import { ReferenceImageNotFoundError, SessionNotFoundError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { IScreenshotEngine, IComparisonEngine, IFeedbackAnalyzer } from '../interfaces/index.js';
import {
  MonitoringSession,
  MonitoringScreenshot,
  MonitoringSummary,
  StartMonitoringParams
} from '../types/index.js';

import { AsyncScheduler } from './async-scheduler.js';
import { AutoFeedbackManager } from './auto-feedback-manager.js';
import { SessionRepository } from './session-repository.js';

const logger = createLogger('MonitoringManager');

export interface MonitoringManagerOptions {
  persistSessions: boolean;
  sessionsDirectory: string;
  autoFeedbackRateLimitMs: number;
  maxConcurrentFeedback: number;
  schedulerJitterMs: number;
  schedulerBackoffMultiplier: number;
  schedulerMaxBackoffMs: number;
}

export class MonitoringManager extends EventEmitter {
  private sessions: Map<string, MonitoringSession> = new Map();
  private schedulers: Map<string, AsyncScheduler> = new Map();
  private screenshotEngine: IScreenshotEngine;
  private comparisonEngine: IComparisonEngine;
  private sessionRepository?: SessionRepository;
  private autoFeedbackManager?: AutoFeedbackManager;
  private options: MonitoringManagerOptions;

  constructor(
    screenshotEngine: IScreenshotEngine,
    comparisonEngine: IComparisonEngine,
    feedbackAnalyzer?: IFeedbackAnalyzer,
    options?: Partial<MonitoringManagerOptions>
  ) {
    super();
    this.screenshotEngine = screenshotEngine;
    this.comparisonEngine = comparisonEngine;

    this.options = {
      persistSessions: options?.persistSessions ?? true,
      sessionsDirectory: options?.sessionsDirectory ?? 'comparisons',
      autoFeedbackRateLimitMs: options?.autoFeedbackRateLimitMs ?? 60000,
      maxConcurrentFeedback: options?.maxConcurrentFeedback ?? 2,
      schedulerJitterMs: options?.schedulerJitterMs ?? 1000,
      schedulerBackoffMultiplier: options?.schedulerBackoffMultiplier ?? 1.5,
      schedulerMaxBackoffMs: options?.schedulerMaxBackoffMs ?? 60000
    };

    // Initialize session repository if persistence enabled
    if (this.options.persistSessions) {
      this.sessionRepository = new SessionRepository(this.options.sessionsDirectory);
    }

    // Initialize auto-feedback manager if feedback analyzer provided
    if (feedbackAnalyzer) {
      this.autoFeedbackManager = new AutoFeedbackManager(feedbackAnalyzer, {
        enabled: true,
        rateLimitMs: this.options.autoFeedbackRateLimitMs,
        maxConcurrent: this.options.maxConcurrentFeedback
      });
    }
  }

  /**
   * Initialize monitoring manager (load persisted sessions)
   */
  async init(): Promise<void> {
    if (this.sessionRepository) {
      await this.sessionRepository.init();

      // Load persisted sessions
      const sessions = await this.sessionRepository.loadAllSessions();
      for (const session of sessions) {
        this.sessions.set(session.id, session);
        logger.info('Loaded persisted session', {
          sessionId: session.id,
          screenshotsCount: session.screenshots.length,
          isActive: session.isActive
        });

        // Recreate and restart schedulers for active sessions
        if (session.isActive) {
          const intervalMs = session.interval * 1000;
          const scheduler = new AsyncScheduler(() => this.captureMonitoringScreenshot(session.id), {
            intervalMs,
            maxJitter: this.options.schedulerJitterMs,
            backoffMultiplier: this.options.schedulerBackoffMultiplier,
            maxBackoffMs: this.options.schedulerMaxBackoffMs
          });

          this.schedulers.set(session.id, scheduler);
          scheduler.start();

          logger.info('Resumed monitoring session', {
            sessionId: session.id,
            intervalSeconds: session.interval
          });
        }
      }
    }
  }

  async startMonitoring(params: StartMonitoringParams): Promise<string> {
    const sessionId = uuidv4();
    const session: MonitoringSession = {
      id: sessionId,
      target: params.target,
      interval: params.interval || 5,
      referenceImagePath: params.referenceImage,
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: params.autoFeedback || false,
      screenshots: []
    };

    if (!(await fs.pathExists(params.referenceImage))) {
      const error = new ReferenceImageNotFoundError(params.referenceImage);
      logger.error('Reference image not found', error, {
        sessionId,
        referenceImage: params.referenceImage
      });
      throw error;
    }

    this.sessions.set(sessionId, session);

    // Persist session if enabled
    if (this.sessionRepository) {
      await this.sessionRepository.saveSession(session);
    }

    // Create async scheduler instead of setInterval
    const intervalMs = (params.interval || 5) * 1000;
    const scheduler = new AsyncScheduler(() => this.captureMonitoringScreenshot(sessionId), {
      intervalMs,
      maxJitter: this.options.schedulerJitterMs,
      backoffMultiplier: this.options.schedulerBackoffMultiplier,
      maxBackoffMs: this.options.schedulerMaxBackoffMs
    });

    this.schedulers.set(sessionId, scheduler);

    // Take initial screenshot immediately before starting scheduler
    await this.captureMonitoringScreenshot(sessionId);

    // Start the scheduler
    scheduler.start();

    logger.info('Monitoring session started', {
      sessionId,
      intervalSeconds: session.interval,
      targetType: session.target.type
    });

    this.emit('monitoring_started', { sessionId, session });

    return sessionId;
  }

  async stopMonitoring(sessionId: string): Promise<MonitoringSummary> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Stop scheduler
    const scheduler = this.schedulers.get(sessionId);
    if (scheduler) {
      scheduler.stop();
      this.schedulers.delete(sessionId);
    }

    // Mark session as inactive
    session.isActive = false;
    const endTime = new Date().toISOString();

    // Generate summary
    const summary = {
      sessionId,
      startTime: session.startTime,
      endTime,
      duration: this.calculateDuration(session.startTime, endTime),
      totalScreenshots: session.screenshots.length,
      significantChanges: session.screenshots.filter(s => s.hasSignificantChange).length,
      averageDifference: this.calculateAverageDifference(session.screenshots),
      screenshots: session.screenshots,
      target: session.target
    };

    // Persist final session state before removal
    if (this.sessionRepository) {
      await this.sessionRepository.saveSession(session);
    }

    // Remove session from memory
    this.sessions.delete(sessionId);

    // Delete session file (session is complete)
    if (this.sessionRepository) {
      await this.sessionRepository.deleteSession(sessionId);
    }

    logger.info('Monitoring session stopped', {
      sessionId,
      duration: summary.duration,
      totalScreenshots: summary.totalScreenshots
    });

    this.emit('monitoring_stopped', { sessionId, summary });

    return summary;
  }

  private async captureMonitoringScreenshot(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

    // AsyncScheduler already prevents overlapping runs, so no need for activeCaptures
    try {
      // Take screenshot (initially saved to global screenshots directory)
      const result = await this.screenshotEngine.takeScreenshot(session.target, {
        format: 'png',
        filename: `monitor_${sessionId}_${Date.now()}.png`,
        fullPage: false
      });

      // Move screenshot to per-session images directory if repository exists (Phase 6.3)
      let finalScreenshotPath = result.filepath;
      if (this.sessionRepository) {
        const imagesDir = this.sessionRepository.getImagesDirectory(sessionId);
        await fs.ensureDir(imagesDir);

        const filename = path.basename(result.filepath);
        const sessionImagePath = path.join(imagesDir, filename);

        // Only move if source file exists (handles mock scenarios in tests)
        if (await fs.pathExists(result.filepath)) {
          await fs.move(result.filepath, sessionImagePath, { overwrite: true });

          logger.debug('Moved screenshot to session directory', {
            sessionId,
            from: result.filepath,
            to: sessionImagePath
          });
        }

        // Store as relative path for portability
        const sessionDir = this.sessionRepository.getSessionDirectory(sessionId);
        finalScreenshotPath = path.relative(sessionDir, sessionImagePath);
      }

      // Compare with reference
      const comparison = await this.comparisonEngine.compare(
        this.sessionRepository
          ? path.join(this.sessionRepository.getSessionDirectory(sessionId), finalScreenshotPath)
          : finalScreenshotPath,
        session.referenceImagePath,
        { tolerance: 5 }
      );

      const monitoringScreenshot: MonitoringScreenshot = {
        filepath: finalScreenshotPath,
        timestamp: result.timestamp,
        differencePercentage: comparison.differencePercentage,
        hasSignificantChange: comparison.differencePercentage > 2 // 2% threshold
      };

      session.screenshots.push(monitoringScreenshot);

      // Persist session after each screenshot
      if (this.sessionRepository) {
        await this.sessionRepository.saveSession(session);
      }

      // Emit events for significant changes
      if (monitoringScreenshot.hasSignificantChange) {
        this.emit('significant_change', {
          sessionId,
          screenshot: monitoringScreenshot,
          comparison
        });

        // Auto-generate feedback if enabled
        if (session.autoFeedback && this.autoFeedbackManager) {
          const triggered = await this.autoFeedbackManager.triggerFeedback(
            sessionId,
            comparison.diffImagePath
          );

          if (triggered) {
            logger.info('Auto-feedback triggered for significant change', {
              sessionId,
              difference: comparison.differencePercentage
            });
          }
        }
      }

      this.emit('screenshot_captured', {
        sessionId,
        screenshot: monitoringScreenshot
      });
    } catch (error) {
      logger.error('Error capturing monitoring screenshot', error as Error, { sessionId });
      throw error;
    }
  }

  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private calculateAverageDifference(screenshots: MonitoringScreenshot[]): number {
    const screenshotsWithDiff = screenshots.filter(s => s.differencePercentage !== undefined);
    if (screenshotsWithDiff.length === 0) return 0;

    const total = screenshotsWithDiff.reduce((sum, s) => sum + (s.differencePercentage || 0), 0);
    return total / screenshotsWithDiff.length;
  }

  async getActiveMonitoringSessions(): Promise<MonitoringSession[]> {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  async getMonitoringSession(sessionId: string): Promise<MonitoringSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getAllMonitoringSessions(): Promise<MonitoringSession[]> {
    return Array.from(this.sessions.values());
  }

  async pauseMonitoring(sessionId: string): Promise<boolean> {
    const scheduler = this.schedulers.get(sessionId);
    if (!scheduler) return false;

    scheduler.stop();

    const session = this.sessions.get(sessionId);
    if (session) {
      // Don't set isActive to false, just pause the scheduler
      this.emit('monitoring_paused', { sessionId });
      logger.info('Monitoring session paused', { sessionId });
      return true;
    }

    return false;
  }

  async resumeMonitoring(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    const scheduler = this.schedulers.get(sessionId);

    if (!session || !session.isActive || !scheduler) return false;

    // Restart the scheduler
    scheduler.start();
    logger.info('Monitoring session resumed', { sessionId });
    this.emit('monitoring_resumed', { sessionId });

    return true;
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up monitoring sessions', {
      activeSessions: this.sessions.size,
      activeSchedulers: this.schedulers.size
    });

    // Stop all schedulers
    for (const [sessionId, scheduler] of this.schedulers.entries()) {
      scheduler.stop();
      this.schedulers.delete(sessionId);
    }

    // Stop all active monitoring sessions
    const sessionIds = Array.from(this.sessions.keys());

    await Promise.allSettled(
      sessionIds.map(async id => {
        try {
          await this.stopMonitoring(id);
        } catch (error) {
          logger.warn(
            'Failed to stop monitoring session during cleanup',
            { sessionId: id },
            error as Error
          );
        }
      })
    );

    this.sessions.clear();
    this.schedulers.clear();

    // Clear auto-feedback state
    if (this.autoFeedbackManager) {
      this.autoFeedbackManager.clear();
    }
  }
}
