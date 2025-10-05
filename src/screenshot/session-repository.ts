import path from 'path';

import fs from 'fs-extra';

import { createLogger } from '../core/logger.js';
import { MonitoringSession } from '../types/index.js';

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
   * Save a session to disk (Phase 6.3 - Uses per-session directory structure)
   */
  async saveSession(session: MonitoringSession): Promise<void> {
    try {
      const sessionDir = this.getSessionDirectory(session.id);
      const imagesDir = this.getImagesDirectory(session.id);

      // Ensure directory structure exists
      await fs.ensureDir(imagesDir);

      const sessionPath = this.getSessionPath(session.id);
      await fs.writeJson(sessionPath, session, { spaces: 2 });

      logger.debug('Session saved', {
        sessionId: session.id,
        screenshotsCount: session.screenshots.length,
        directory: sessionDir
      });
    } catch (error) {
      logger.error('Failed to save session', error as Error, { sessionId: session.id });
      throw error;
    }
  }

  /**
   * Load a session from disk (Phase 6.3 - Handles migration from legacy format)
   */
  async loadSession(sessionId: string): Promise<MonitoringSession | null> {
    try {
      // Check if this is a legacy session that needs migration
      if (await this.isLegacySession(sessionId)) {
        logger.info('Detected legacy session, auto-migrating', { sessionId });
        return await this.migrateLegacySession(sessionId);
      }

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
   * Load all sessions from disk (Phase 6.3 - Handles both legacy and new formats)
   */
  async loadAllSessions(): Promise<MonitoringSession[]> {
    try {
      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true });

      // Collect session IDs from both formats
      const sessionIds = new Set<string>();

      // Legacy format: *.json files
      entries
        .filter(
          entry =>
            entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.migrated')
        )
        .forEach(entry => sessionIds.add(path.basename(entry.name, '.json')));

      // New format: directories with session.json inside
      for (const entry of entries.filter(e => e.isDirectory())) {
        const sessionJsonPath = path.join(this.sessionsDir, entry.name, 'session.json');
        if (await fs.pathExists(sessionJsonPath)) {
          sessionIds.add(entry.name);
        }
      }

      // Load all sessions (auto-migrates legacy ones)
      const sessions = await Promise.all(
        Array.from(sessionIds).map(sessionId => this.loadSession(sessionId))
      );

      // Filter out null values
      const validSessions = sessions.filter((s): s is MonitoringSession => s !== null);

      logger.debug('All sessions loaded', {
        count: validSessions.length,
        totalFound: sessionIds.size
      });

      return validSessions;
    } catch (error) {
      logger.error('Failed to load all sessions', error as Error);
      return [];
    }
  }

  /**
   * Delete a session from disk (Phase 6.3 - Deletes entire session directory)
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionDir = this.getSessionDirectory(sessionId);

      if (await fs.pathExists(sessionDir)) {
        await fs.remove(sessionDir);
        logger.debug('Session directory deleted', { sessionId, directory: sessionDir });
        return true;
      }

      // Also check for legacy format
      const legacyPath = this.getLegacySessionPath(sessionId);
      if (await fs.pathExists(legacyPath)) {
        await fs.remove(legacyPath);
        logger.debug('Legacy session file deleted', { sessionId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete session', error as Error, { sessionId });
      return false;
    }
  }

  /**
   * List all session IDs (Phase 6.3 - Handles both legacy and new formats)
   */
  async listSessionIds(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true });
      const sessionIds = new Set<string>();

      // Legacy format: *.json files
      entries
        .filter(
          entry =>
            entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.migrated')
        )
        .forEach(entry => sessionIds.add(path.basename(entry.name, '.json')));

      // New format: directories
      for (const entry of entries.filter(e => e.isDirectory())) {
        const sessionJsonPath = path.join(this.sessionsDir, entry.name, 'session.json');
        if (await fs.pathExists(sessionJsonPath)) {
          sessionIds.add(entry.name);
        }
      }

      return Array.from(sessionIds);
    } catch (error) {
      logger.error('Failed to list sessions', error as Error);
      return [];
    }
  }

  /**
   * Get the directory for a session (Phase 6.3 - Per-session directories)
   */
  getSessionDirectory(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId);
  }

  /**
   * Get the images directory for a session
   */
  getImagesDirectory(sessionId: string): string {
    return path.join(this.getSessionDirectory(sessionId), 'images');
  }

  /**
   * Get the recordings directory for a session (reserved for future video capture)
   */
  getRecordingsDirectory(sessionId: string): string {
    return path.join(this.getSessionDirectory(sessionId), 'recordings');
  }

  /**
   * Get the file path for a session metadata JSON (new structure)
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.getSessionDirectory(sessionId), 'session.json');
  }

  /**
   * Get legacy flat JSON path for migration detection
   */
  private getLegacySessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Detect if a session exists in legacy flat structure
   */
  private async isLegacySession(sessionId: string): Promise<boolean> {
    const legacyPath = this.getLegacySessionPath(sessionId);
    const newPath = this.getSessionPath(sessionId);

    const legacyExists = await fs.pathExists(legacyPath);
    const newExists = await fs.pathExists(newPath);

    // Legacy if old format exists and new doesn't
    return legacyExists && !newExists;
  }

  /**
   * Migrate a legacy session to new per-session directory structure
   */
  private async migrateLegacySession(sessionId: string): Promise<MonitoringSession | null> {
    const legacyPath = this.getLegacySessionPath(sessionId);

    try {
      logger.info('Migrating legacy session to per-session directory', { sessionId });

      // Load legacy session
      const session = (await fs.readJson(legacyPath)) as MonitoringSession;

      // Create new directory structure
      const imagesDir = this.getImagesDirectory(sessionId);
      await fs.ensureDir(imagesDir);

      // Migrate screenshots to images/ directory
      for (const screenshot of session.screenshots) {
        const oldPath = screenshot.filepath;
        const filename = path.basename(oldPath);
        const newPath = path.join(imagesDir, filename);

        // Copy screenshot if it exists
        if (await fs.pathExists(oldPath)) {
          await fs.copy(oldPath, newPath);
          logger.debug('Migrated screenshot', { from: oldPath, to: newPath });
        } else {
          logger.warn('Screenshot file not found during migration', { filepath: oldPath });
        }

        // Update to relative path for portability
        screenshot.filepath = path.join('images', filename);
      }

      // Save to new location
      const newSessionPath = this.getSessionPath(sessionId);
      await fs.writeJson(newSessionPath, session, { spaces: 2 });

      // Rename legacy file for safety (can be deleted manually later)
      const backupPath = `${legacyPath}.migrated`;
      await fs.rename(legacyPath, backupPath);

      logger.info('Legacy session migrated successfully', {
        sessionId,
        screenshotsMigrated: session.screenshots.length,
        legacyBackup: backupPath
      });

      return session;
    } catch (error) {
      logger.error('Failed to migrate legacy session', error as Error, { sessionId });
      return null;
    }
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
