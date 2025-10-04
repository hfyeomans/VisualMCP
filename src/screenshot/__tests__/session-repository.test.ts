import fs from 'fs-extra';
import path from 'path';
import { SessionRepository } from '../session-repository.js';
import { MonitoringSession } from '../../types/index.js';

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

    const sessionPath = path.join(testDir, 'sessions', 'test-session-1.json');
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
          filepath: '/path/to/screenshot.png',
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
            filepath: '/screenshot1.png',
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

    const sessionPath = path.join(testDir, 'sessions', 'session-to-delete.json');
    expect(await fs.pathExists(sessionPath)).toBe(true);

    await repository.deleteSession('session-to-delete');

    expect(await fs.pathExists(sessionPath)).toBe(false);
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
      filepath: '/new-screenshot.png',
      timestamp: new Date().toISOString(),
      differencePercentage: 2.5,
      hasSignificantChange: true
    });

    await repository.saveSession(session);

    const loaded = await repository.loadSession('update-test');
    expect(loaded?.screenshots).toHaveLength(1);
    expect(loaded?.screenshots[0]?.filepath).toBe('/new-screenshot.png');
  });
});
