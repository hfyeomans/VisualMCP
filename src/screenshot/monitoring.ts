import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import { 
  MonitoringSession, 
  MonitoringScreenshot, 
  StartMonitoringParams
} from '../types/index.js';
import { ScreenshotEngine } from './puppeteer.js';
import { ComparisonEngine } from '../comparison/differ.js';

export class MonitoringManager extends EventEmitter {
  private sessions: Map<string, MonitoringSession> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private screenshotEngine: ScreenshotEngine;
  private comparisonEngine: ComparisonEngine;

  constructor(screenshotEngine: ScreenshotEngine, comparisonEngine: ComparisonEngine) {
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

    // Validate reference image exists
    if (!await fs.pathExists(params.referenceImage)) {
      throw new Error(`Reference image not found: ${params.referenceImage}`);
    }

    this.sessions.set(sessionId, session);

    // Start monitoring interval
    const intervalId = setInterval(async () => {
      try {
        await this.captureMonitoringScreenshot(sessionId);
      } catch (error) {
        console.error(`Error in monitoring session ${sessionId}:`, error);
        this.emit('monitoring_error', { sessionId, error });
      }
    }, params.interval * 1000);

    this.intervals.set(sessionId, intervalId);

    // Take initial screenshot immediately
    await this.captureMonitoringScreenshot(sessionId);

    this.emit('monitoring_started', { sessionId, session });
    
    return sessionId;
  }

  async stopMonitoring(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Monitoring session not found: ${sessionId}`);
    }

    // Clear interval
    const intervalId = this.intervals.get(sessionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(sessionId);
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

    // Remove session
    this.sessions.delete(sessionId);

    this.emit('monitoring_stopped', { sessionId, summary });

    return summary;
  }

  private async captureMonitoringScreenshot(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

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
          // This would integrate with FeedbackAnalyzer
          // For now, just log the change
          console.log(`Significant change detected in session ${sessionId}: ${comparison.differencePercentage}%`);
        }
      }

      this.emit('screenshot_captured', {
        sessionId,
        screenshot: monitoringScreenshot
      });

    } catch (error) {
      console.error(`Error capturing monitoring screenshot for session ${sessionId}:`, error);
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
    const intervalId = this.intervals.get(sessionId);
    if (!intervalId) return false;

    clearInterval(intervalId);
    this.intervals.delete(sessionId);

    const session = this.sessions.get(sessionId);
    if (session) {
      // Don't set isActive to false, just pause the interval
      this.emit('monitoring_paused', { sessionId });
      return true;
    }

    return false;
  }

  async resumeMonitoring(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return false;

    // Restart the interval
    const intervalId = setInterval(async () => {
      try {
        await this.captureMonitoringScreenshot(sessionId);
      } catch (error) {
        console.error(`Error in monitoring session ${sessionId}:`, error);
        this.emit('monitoring_error', { sessionId, error });
      }
    }, session.interval * 1000);

    this.intervals.set(sessionId, intervalId);
    this.emit('monitoring_resumed', { sessionId });
    
    return true;
  }

  async cleanup(): Promise<void> {
    // Stop all active monitoring sessions
    for (const sessionId of this.sessions.keys()) {
      try {
        await this.stopMonitoring(sessionId);
      } catch (error) {
        console.error(`Error stopping monitoring session ${sessionId} during cleanup:`, error);
      }
    }

    // Clear all intervals
    for (const intervalId of this.intervals.values()) {
      clearInterval(intervalId);
    }

    this.intervals.clear();
    this.sessions.clear();
  }
}