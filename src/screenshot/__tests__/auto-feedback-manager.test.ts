import { IFeedbackAnalyzer } from '../../interfaces/index.js';
import { FeedbackResult } from '../../types/index.js';
import { AutoFeedbackManager } from '../auto-feedback-manager.js';

describe('AutoFeedbackManager', () => {
  let mockAnalyzer: jest.Mocked<IFeedbackAnalyzer>;
  let manager: AutoFeedbackManager;

  beforeEach(() => {
    jest.useFakeTimers();
    mockAnalyzer = {
      analyzeDifferences: jest.fn().mockResolvedValue({
        summary: 'Test feedback',
        issues: [],
        suggestions: [],
        priority: 'layout',
        confidence: 85
      } as FeedbackResult)
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should enforce rate limiting per session', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 5000,
      maxConcurrent: 5
    });

    const sessionId = 'session-1';

    // First trigger should succeed
    const result1 = await manager.triggerFeedback(sessionId, '/diff1.png');
    await jest.runAllTimersAsync();
    expect(result1).toBe(true);
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalledTimes(1);

    // Second trigger within rate limit should be blocked
    const result2 = await manager.triggerFeedback(sessionId, '/diff2.png');
    expect(result2).toBe(false);
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalledTimes(1);

    // Advance time past rate limit
    jest.advanceTimersByTime(5001);
    await jest.runAllTimersAsync();

    // Third trigger should succeed
    const result3 = await manager.triggerFeedback(sessionId, '/diff3.png');
    await jest.runAllTimersAsync();
    expect(result3).toBe(true);
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalledTimes(2);
  });

  it('should allow concurrent feedback for different sessions', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 5000,
      maxConcurrent: 5
    });

    const result1 = await manager.triggerFeedback('session-1', '/diff1.png');
    const result2 = await manager.triggerFeedback('session-2', '/diff2.png');
    const result3 = await manager.triggerFeedback('session-3', '/diff3.png');

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalledTimes(3);
  });

  it('should enforce max concurrent feedback limit', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 1000,
      maxConcurrent: 2
    });

    let resolveAnalysis1: (value: FeedbackResult) => void;
    let resolveAnalysis2: (value: FeedbackResult) => void;

    const analysis1Promise = new Promise<FeedbackResult>(resolve => {
      resolveAnalysis1 = resolve;
    });
    const analysis2Promise = new Promise<FeedbackResult>(resolve => {
      resolveAnalysis2 = resolve;
    });

    mockAnalyzer.analyzeDifferences
      .mockReturnValueOnce(analysis1Promise)
      .mockReturnValueOnce(analysis2Promise);

    // Start 2 concurrent analyses (should succeed)
    const trigger1 = manager.triggerFeedback('session-1', '/diff1.png');
    const trigger2 = manager.triggerFeedback('session-2', '/diff2.png');

    await Promise.resolve(); // Let triggers start

    // Third should be queued (max concurrent = 2)
    const result3 = await manager.triggerFeedback('session-3', '/diff3.png');
    expect(result3).toBe(false); // Queued because limit reached

    // Resolve the analyses
    resolveAnalysis1!({
      summary: 'Test',
      issues: [],
      suggestions: [],
      priority: 'layout',
      confidence: 85
    });
    resolveAnalysis2!({
      summary: 'Test',
      issues: [],
      suggestions: [],
      priority: 'layout',
      confidence: 85
    });

    await trigger1;
    await trigger2;
  });

  it('should process queued feedback when capacity available', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 1000,
      maxConcurrent: 1
    });

    let resolveFirst: (value: FeedbackResult) => void;
    const firstPromise = new Promise<FeedbackResult>(resolve => {
      resolveFirst = resolve;
    });

    mockAnalyzer.analyzeDifferences.mockImplementationOnce(() => firstPromise);

    // Start first analysis
    const trigger1 = manager.triggerFeedback('session-1', '/diff1.png');

    // Queue second (over concurrent limit)
    const result2 = await manager.triggerFeedback('session-2', '/diff2.png');
    expect(result2).toBe(false); // Queued

    // Complete first analysis
    resolveFirst!({
      summary: 'Test',
      issues: [],
      suggestions: [],
      priority: 'layout',
      confidence: 85
    });

    await trigger1;
    await jest.runAllTimersAsync();
    await Promise.resolve(); // Let queue processor run

    // Queued item should have been processed
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalledTimes(2);
  }, 10000);

  it('should handle analyzer errors gracefully', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 1000,
      maxConcurrent: 5
    });

    mockAnalyzer.analyzeDifferences.mockRejectedValueOnce(new Error('Analysis failed'));

    const result = await manager.triggerFeedback('session-1', '/diff.png');

    expect(result).toBe(true); // Triggered despite error
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalled();

    // Should be able to trigger again for same session after rate limit
    jest.advanceTimersByTime(1000);

    mockAnalyzer.analyzeDifferences.mockResolvedValueOnce({
      summary: 'Test',
      issues: [],
      suggestions: [],
      priority: 'layout',
      confidence: 85
    } as FeedbackResult);

    const result2 = await manager.triggerFeedback('session-1', '/diff2.png');
    expect(result2).toBe(true);
  });

  it('should clear all state', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 5000,
      maxConcurrent: 5
    });

    await manager.triggerFeedback('session-1', '/diff1.png');

    // Clear state
    manager.clear();

    // Should be able to trigger immediately (rate limit cleared)
    const result = await manager.triggerFeedback('session-1', '/diff2.png');
    expect(result).toBe(true);
    expect(mockAnalyzer.analyzeDifferences).toHaveBeenCalledTimes(2);
  });

  it('should track rate limits independently per session', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: true,
      rateLimitMs: 3000,
      maxConcurrent: 5
    });

    // Session 1
    await manager.triggerFeedback('session-1', '/diff1.png');

    // Advance time 1s
    jest.advanceTimersByTime(1000);

    // Session 2 (different session, no rate limit)
    const result2 = await manager.triggerFeedback('session-2', '/diff2.png');
    expect(result2).toBe(true);

    // Session 1 again (still within rate limit)
    const result3 = await manager.triggerFeedback('session-1', '/diff3.png');
    expect(result3).toBe(false);

    // Advance time past session-1 rate limit
    jest.advanceTimersByTime(2000);

    // Session 1 should work now
    const result4 = await manager.triggerFeedback('session-1', '/diff4.png');
    expect(result4).toBe(true);
  });

  it('should respect disabled state', async () => {
    manager = new AutoFeedbackManager(mockAnalyzer, {
      enabled: false,
      rateLimitMs: 1000,
      maxConcurrent: 5
    });

    const result = await manager.triggerFeedback('session-1', '/diff.png');

    expect(result).toBe(false);
    expect(mockAnalyzer.analyzeDifferences).not.toHaveBeenCalled();
  });
});
