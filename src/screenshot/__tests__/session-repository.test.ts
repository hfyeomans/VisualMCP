import path from 'path';

import fs from 'fs-extra';

import { MonitoringSession } from '../../types/index.js';
import { SessionRepository } from '../session-repository.js';

describe('SessionRepository', () => {
  const testDir = path.join(process.cwd(), 'test-sessions');
  let repository: SessionRepository;

  beforeEach(async () => {
    repository = new SessionRepository(testDir);
    await repository.init();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('should persist sessions to filesystem', async () => {
    const session: MonitoringSession = {
      id: 'test-session-1',
      target: { type: 'url', url: 'https://example.com' },
      interval: 5,
      referenceImagePath: '/path/to/ref.png',
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: false,
      screenshots: []
    };

    await repository.saveSession(session);

    // New structure: session directory with session.json inside
    const sessionPath = path.join(testDir, 'sessions', 'test-session-1', 'session.json');
    expect(await fs.pathExists(sessionPath)).toBe(true);

    const savedData = await fs.readJson(sessionPath);
    expect(savedData).toEqual(session);
  });

  it('should load persisted sessions', async () => {
    const session: MonitoringSession = {
      id: 'test-session-2',
      target: { type: 'url', url: 'https://example.com' },
      interval: 5,
      referenceImagePath: '/path/to/ref.png',
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: false,
      screenshots: [
        {
          filepath: 'images/screenshot.png',
          timestamp: new Date().toISOString(),
          differencePercentage: 1.5,
          hasSignificantChange: false
        }
      ]
    };

    await repository.saveSession(session);

    const loaded = await repository.loadSession('test-session-2');
    expect(loaded).toEqual(session);
  });

  it('should verify persisted sessions survive restart', async () => {
    // Create and save multiple sessions
    const sessions: MonitoringSession[] = [
      {
        id: 'session-1',
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref1.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      },
      {
        id: 'session-2',
        target: { type: 'region', x: 0, y: 0, width: 100, height: 100 },
        interval: 10,
        referenceImagePath: '/ref2.png',
        startTime: new Date().toISOString(),
        isActive: false,
        autoFeedback: true,
        screenshots: [
          {
            filepath: 'images/screenshot1.png',
            timestamp: new Date().toISOString(),
            differencePercentage: 3.2,
            hasSignificantChange: true
          }
        ]
      }
    ];

    for (const session of sessions) {
      await repository.saveSession(session);
    }

    // Simulate restart: create new repository instance
    const newRepository = new SessionRepository(testDir);
    await newRepository.init();

    const loadedSessions = await newRepository.loadAllSessions();

    expect(loadedSessions).toHaveLength(2);
    expect(loadedSessions).toEqual(expect.arrayContaining(sessions));
  });

  it('should load all sessions from directory', async () => {
    const session1: MonitoringSession = {
      id: 'session-a',
      target: { type: 'url', url: 'https://a.com' },
      interval: 5,
      referenceImagePath: '/ref.png',
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: false,
      screenshots: []
    };

    const session2: MonitoringSession = {
      id: 'session-b',
      target: { type: 'url', url: 'https://b.com' },
      interval: 10,
      referenceImagePath: '/ref.png',
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: false,
      screenshots: []
    };

    await repository.saveSession(session1);
    await repository.saveSession(session2);

    const allSessions = await repository.loadAllSessions();

    expect(allSessions).toHaveLength(2);
    expect(allSessions.map(s => s.id)).toEqual(expect.arrayContaining(['session-a', 'session-b']));
  });

  it('should delete sessions', async () => {
    const session: MonitoringSession = {
      id: 'session-to-delete',
      target: { type: 'url', url: 'https://example.com' },
      interval: 5,
      referenceImagePath: '/ref.png',
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: false,
      screenshots: []
    };

    await repository.saveSession(session);

    // New structure: session directory
    const sessionDir = path.join(testDir, 'sessions', 'session-to-delete');
    expect(await fs.pathExists(sessionDir)).toBe(true);

    await repository.deleteSession('session-to-delete');

    expect(await fs.pathExists(sessionDir)).toBe(false);
  });

  it('should list session IDs', async () => {
    const sessions = ['session-1', 'session-2', 'session-3'];

    for (const id of sessions) {
      const session: MonitoringSession = {
        id,
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      };
      await repository.saveSession(session);
    }

    const ids = await repository.listSessionIds();

    expect(ids).toHaveLength(3);
    expect(ids).toEqual(expect.arrayContaining(sessions));
  });

  it('should clear all sessions', async () => {
    const sessions = ['session-1', 'session-2'];

    for (const id of sessions) {
      const session: MonitoringSession = {
        id,
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      };
      await repository.saveSession(session);
    }

    expect(await repository.listSessionIds()).toHaveLength(2);

    await repository.clearAll();

    expect(await repository.listSessionIds()).toHaveLength(0);
  });

  it('should handle loading non-existent session', async () => {
    const loaded = await repository.loadSession('non-existent');
    expect(loaded).toBeNull();
  });

  it('should handle deleting non-existent session gracefully', async () => {
    await expect(repository.deleteSession('non-existent')).resolves.not.toThrow();
  });

  it('should update existing session when saved again', async () => {
    const session: MonitoringSession = {
      id: 'update-test',
      target: { type: 'url', url: 'https://example.com' },
      interval: 5,
      referenceImagePath: '/ref.png',
      startTime: new Date().toISOString(),
      isActive: true,
      autoFeedback: false,
      screenshots: []
    };

    await repository.saveSession(session);

    // Update session
    session.screenshots.push({
      filepath: 'images/new-screenshot.png',
      timestamp: new Date().toISOString(),
      differencePercentage: 2.5,
      hasSignificantChange: true
    });

    await repository.saveSession(session);

    const loaded = await repository.loadSession('update-test');
    expect(loaded?.screenshots).toHaveLength(1);
    expect(loaded?.screenshots[0]?.filepath).toBe('images/new-screenshot.png');
  });

  describe('Per-Session Directory Structure (Phase 6.3)', () => {
    it('should create per-session directory structure', async () => {
      const session: MonitoringSession = {
        id: 'structured-session',
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      };

      await repository.saveSession(session);

      // Verify directory structure
      const sessionDir = repository.getSessionDirectory('structured-session');
      const imagesDir = repository.getImagesDirectory('structured-session');
      const sessionJsonPath = path.join(sessionDir, 'session.json');

      expect(await fs.pathExists(sessionDir)).toBe(true);
      expect(await fs.pathExists(imagesDir)).toBe(true);
      expect(await fs.pathExists(sessionJsonPath)).toBe(true);
    });

    it('should use relative paths for screenshots', async () => {
      const session: MonitoringSession = {
        id: 'relative-paths-test',
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: [
          {
            filepath: 'images/screenshot1.png',
            timestamp: new Date().toISOString(),
            differencePercentage: 1.0,
            hasSignificantChange: false
          }
        ]
      };

      await repository.saveSession(session);

      const loaded = await repository.loadSession('relative-paths-test');
      expect(loaded?.screenshots[0]?.filepath).toBe('images/screenshot1.png');
      expect(loaded?.screenshots[0]?.filepath).not.toContain(testDir);
    });

    it('should delete entire session directory', async () => {
      const session: MonitoringSession = {
        id: 'delete-directory-test',
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      };

      await repository.saveSession(session);

      const sessionDir = repository.getSessionDirectory('delete-directory-test');
      expect(await fs.pathExists(sessionDir)).toBe(true);

      await repository.deleteSession('delete-directory-test');

      expect(await fs.pathExists(sessionDir)).toBe(false);
    });
  });

  describe('Legacy Session Migration (Phase 6.3)', () => {
    it('should detect legacy flat JSON sessions', async () => {
      // Manually create legacy format session
      const sessionsDir = path.join(testDir, 'sessions');
      await fs.ensureDir(sessionsDir);

      // Create dummy screenshot file first
      const screenshotPath = path.join(testDir, 'old-screenshots', 'screenshot.png');
      await fs.ensureDir(path.dirname(screenshotPath));
      await fs.writeFile(screenshotPath, 'dummy');

      const legacySession: MonitoringSession = {
        id: 'legacy-session',
        target: { type: 'url', url: 'https://example.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: [
          {
            filepath: screenshotPath,
            timestamp: new Date().toISOString(),
            differencePercentage: 1.0,
            hasSignificantChange: false
          }
        ]
      };

      const legacyPath = path.join(sessionsDir, 'legacy-session.json');
      await fs.writeJson(legacyPath, legacySession);

      // Load should trigger migration
      const loaded = await repository.loadSession('legacy-session');

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('legacy-session');

      // Verify new structure exists
      const sessionDir = repository.getSessionDirectory('legacy-session');
      const newSessionPath = path.join(sessionDir, 'session.json');
      expect(await fs.pathExists(newSessionPath)).toBe(true);

      // Verify screenshot was migrated
      const imagesDir = repository.getImagesDirectory('legacy-session');
      const migratedScreenshot = path.join(imagesDir, 'screenshot.png');
      expect(await fs.pathExists(migratedScreenshot)).toBe(true);

      // Verify path is now relative
      expect(loaded?.screenshots[0]?.filepath).toBe('images/screenshot.png');

      // Verify legacy file was backed up
      const backupPath = `${legacyPath}.migrated`;
      expect(await fs.pathExists(backupPath)).toBe(true);
    });

    it('should load mixed legacy and new format sessions', async () => {
      // Create one legacy session
      const sessionsDir = path.join(testDir, 'sessions');
      await fs.ensureDir(sessionsDir);

      const legacySession: MonitoringSession = {
        id: 'legacy-1',
        target: { type: 'url', url: 'https://legacy.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      };

      await fs.writeJson(path.join(sessionsDir, 'legacy-1.json'), legacySession);

      // Create one new format session
      const newSession: MonitoringSession = {
        id: 'new-1',
        target: { type: 'url', url: 'https://new.com' },
        interval: 5,
        referenceImagePath: '/ref.png',
        startTime: new Date().toISOString(),
        isActive: true,
        autoFeedback: false,
        screenshots: []
      };

      await repository.saveSession(newSession);

      // Load all should find both
      const allSessions = await repository.loadAllSessions();

      expect(allSessions).toHaveLength(2);
      expect(allSessions.map(s => s.id)).toEqual(expect.arrayContaining(['legacy-1', 'new-1']));

      // Verify legacy was migrated
      const legacyBackup = path.join(sessionsDir, 'legacy-1.json.migrated');
      expect(await fs.pathExists(legacyBackup)).toBe(true);
    });

    it('should skip already migrated sessions', async () => {
      // Create a .migrated file
      const sessionsDir = path.join(testDir, 'sessions');
      await fs.ensureDir(sessionsDir);

      const migratedPath = path.join(sessionsDir, 'already-migrated.json.migrated');
      await fs.writeJson(migratedPath, { id: 'already-migrated' });

      // Should not appear in listings
      const sessions = await repository.loadAllSessions();
      expect(sessions.map(s => s.id)).not.toContain('already-migrated');
    });
  });
});
