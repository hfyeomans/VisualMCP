import fs from 'fs-extra';
import path from 'path';
import { MonitoringSession } from '../types/index.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('SessionRepository');

/**
 * Filesystem-backed repository for monitoring sessions
 * Enables session persistence across process restarts
 */
export class SessionRepository {
  private sessionsDir: string;

  constructor(baseDirectory: string) {
    this.sessionsDir = path.join(baseDirectory, 'sessions');
  }

  /**
   * Initialize the repository
   */
  async init(): Promise<void> {
    try {
      await fs.ensureDir(this.sessionsDir);
      logger.debug('Session repository initialized', { directory: this.sessionsDir });
    } catch (error) {
      logger.error('Failed to initialize session repository', error as Error);
      throw error;
    }
  }

  /**
   * Save a session to disk
   */
  async saveSession(session: MonitoringSession): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(session.id);
      await fs.writeJson(sessionPath, session, { spaces: 2 });

      logger.debug('Session saved', {
        sessionId: session.id,
        screenshotsCount: session.screenshots.length
      });
    } catch (error) {
      logger.error('Failed to save session', error as Error, { sessionId: session.id });
      throw error;
    }
  }

  /**
   * Load a session from disk
   */
  async loadSession(sessionId: string): Promise<MonitoringSession | null> {
    try {
      const sessionPath = this.getSessionPath(sessionId);

      if (!(await fs.pathExists(sessionPath))) {
        logger.debug('Session file not found', { sessionId });
        return null;
      }

      const session = await fs.readJson(sessionPath);
      logger.debug('Session loaded', { sessionId });

      return session as MonitoringSession;
    } catch (error) {
      logger.error('Failed to load session', error as Error, { sessionId });
      return null;
    }
  }

  /**
   * Load all sessions from disk
   */
  async loadAllSessions(): Promise<MonitoringSession[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));

      const sessions = await Promise.all(
        sessionFiles.map(async file => {
          const sessionId = path.basename(file, '.json');
          return this.loadSession(sessionId);
        })
      );

      // Filter out null values
      const validSessions = sessions.filter((s): s is MonitoringSession => s !== null);

      logger.debug('All sessions loaded', { count: validSessions.length });

      return validSessions;
    } catch (error) {
      logger.error('Failed to load all sessions', error as Error);
      return [];
    }
  }

  /**
   * Delete a session from disk
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionPath = this.getSessionPath(sessionId);

      if (await fs.pathExists(sessionPath)) {
        await fs.remove(sessionPath);
        logger.debug('Session deleted', { sessionId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete session', error as Error, { sessionId });
      return false;
    }
  }

  /**
   * List all session IDs
   */
  async listSessionIds(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      return files.filter(file => file.endsWith('.json')).map(file => path.basename(file, '.json'));
    } catch (error) {
      logger.error('Failed to list sessions', error as Error);
      return [];
    }
  }

  /**
   * Get the file path for a session
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<void> {
    try {
      await fs.emptyDir(this.sessionsDir);
      logger.debug('All sessions cleared');
    } catch (error) {
      logger.error('Failed to clear sessions', error as Error);
      throw error;
    }
  }
}
