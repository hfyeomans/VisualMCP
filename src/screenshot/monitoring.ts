import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import {
  MonitoringSession,
  MonitoringScreenshot,
  MonitoringSummary,
  StartMonitoringParams
} from '../types/index.js';
import { IScreenshotEngine, IComparisonEngine } from '../interfaces/index.js';
import { createLogger } from '../core/logger.js';
import { ReferenceImageNotFoundError, SessionNotFoundError } from '../core/errors.js';

const logger = createLogger('MonitoringManager');

export class MonitoringManager extends EventEmitter {
  private sessions: Map<string, MonitoringSession> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private activeCaptures = new Set<string>();
  private screenshotEngine: IScreenshotEngine;
  private comparisonEngine: IComparisonEngine;

  constructor(screenshotEngine: IScreenshotEngine, comparisonEngine: IComparisonEngine) {
    super();
    this.screenshotEngine = screenshotEngine;
    this.comparisonEngine = comparisonEngine;
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

    // Start monitoring interval
    const intervalMs = (params.interval || 5) * 1000;
    const intervalId = setInterval(() => {
      void this.captureMonitoringScreenshot(sessionId).catch(error => {
        logger.error('Error during monitoring interval', error as Error, { sessionId });
        this.emit('monitoring_error', { sessionId, error });
      });
    }, intervalMs);

    this.intervals.set(sessionId, intervalId);

    // Take initial screenshot immediately
    await this.captureMonitoringScreenshot(sessionId);

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

    this.clearInterval(sessionId);

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

    // Remove session
    this.sessions.delete(sessionId);

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

    if (this.activeCaptures.has(sessionId)) {
      logger.debug('Skipping capture while previous run is in progress', { sessionId });
      return;
    }

    this.activeCaptures.add(sessionId);

    try {
      // Take screenshot
      const result = await this.screenshotEngine.takeScreenshot(session.target, {
        format: 'png',
        filename: `monitor_${sessionId}_${Date.now()}.png`,
        fullPage: false
      });

      // Compare with reference
      const comparison = await this.comparisonEngine.compare(
        result.filepath,
        session.referenceImagePath,
        { tolerance: 5 }
      );

      const monitoringScreenshot: MonitoringScreenshot = {
        filepath: result.filepath,
        timestamp: result.timestamp,
        differencePercentage: comparison.differencePercentage,
        hasSignificantChange: comparison.differencePercentage > 2 // 2% threshold
      };

      session.screenshots.push(monitoringScreenshot);

      // Emit events for significant changes
      if (monitoringScreenshot.hasSignificantChange) {
        this.emit('significant_change', {
          sessionId,
          screenshot: monitoringScreenshot,
          comparison
        });

        // Auto-generate feedback if enabled
        if (session.autoFeedback) {
          logger.info('Significant change detected with autoFeedback enabled', {
            sessionId,
            difference: comparison.differencePercentage
          });
        }
      }

      this.emit('screenshot_captured', {
        sessionId,
        screenshot: monitoringScreenshot
      });
    } catch (error) {
      logger.error('Error capturing monitoring screenshot', error as Error, { sessionId });
      throw error;
    } finally {
      this.activeCaptures.delete(sessionId);
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
    const intervalId = this.intervals.get(sessionId);
    if (!intervalId) return false;

    clearInterval(intervalId);
    this.intervals.delete(sessionId);

    const session = this.sessions.get(sessionId);
    if (session) {
      // Don't set isActive to false, just pause the interval
      this.emit('monitoring_paused', { sessionId });
      logger.info('Monitoring session paused', { sessionId });
      return true;
    }

    return false;
  }

  async resumeMonitoring(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return false;

    // Restart the interval
    const intervalId = setInterval(() => {
      void this.captureMonitoringScreenshot(sessionId).catch(error => {
        logger.error('Error during monitoring interval', error as Error, { sessionId });
        this.emit('monitoring_error', { sessionId, error });
      });
    }, session.interval * 1000);

    this.intervals.set(sessionId, intervalId);
    logger.info('Monitoring session resumed', { sessionId });
    this.emit('monitoring_resumed', { sessionId });

    return true;
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up monitoring sessions', {
      activeSessions: this.sessions.size,
      activeIntervals: this.intervals.size
    });

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

    for (const [sessionId, intervalId] of this.intervals.entries()) {
      clearInterval(intervalId);
      this.intervals.delete(sessionId);
    }

    this.sessions.clear();
    this.activeCaptures.clear();
  }

  private clearInterval(sessionId: string): void {
    const intervalId = this.intervals.get(sessionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(sessionId);
    }
  }
}
