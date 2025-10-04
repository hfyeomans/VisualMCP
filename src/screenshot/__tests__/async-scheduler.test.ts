import { AsyncScheduler } from '../async-scheduler.js';

describe('AsyncScheduler', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should prevent overlapping task executions', async () => {
    const executionOrder: number[] = [];
    let taskCount = 0;

    const task = async () => {
      const taskId = ++taskCount;
      executionOrder.push(taskId);
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 100));
      executionOrder.push(-taskId); // Mark completion
    };

    const scheduler = new AsyncScheduler(task, { intervalMs: 50 });
    scheduler.start();

    // Fast-forward through multiple intervals
    for (let i = 0; i < 5; i++) {
      jest.advanceTimersByTime(50);
      await Promise.resolve(); // Flush promises
    }

    scheduler.stop();

    // Verify no overlapping: each task completes before next starts
    for (let i = 0; i < executionOrder.length - 1; i++) {
      const current = executionOrder[i];
      if (current && current > 0) {
        // Positive number = task start
        const taskId = current;
        const nextIndex = i + 1;
        const next = executionOrder[nextIndex];
        // Next entry should be completion of same task
        expect(next).toBe(-taskId);
      }
    }
  });

  it('should verify no overlapping runs across 100 iterations', async () => {
    const runLog: Array<{ start: number; end: number }> = [];
    let _currentRun = 0;

    const task = async () => {
      _currentRun++;
      const start = Date.now();
      runLog.push({ start, end: 0 });

      // Simulate work taking 10-50ms
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 40) + 10));

      const index = runLog.findIndex(r => r.start === start);
      if (index >= 0 && runLog[index]) {
        runLog[index]!.end = Date.now();
      }
    };

    const scheduler = new AsyncScheduler(task, { intervalMs: 20 });
    scheduler.start();

    // Run for 100 iterations
    for (let i = 0; i < 100; i++) {
      jest.advanceTimersByTime(20);
      await Promise.resolve();
    }

    scheduler.stop();

    // Verify no overlaps: each run ends before next starts
    for (let i = 0; i < runLog.length - 1; i++) {
      const current = runLog[i];
      const next = runLog[i + 1];
      if (current && next) {
        expect(current.end).toBeLessThanOrEqual(next.start);
      }
    }

    expect(runLog.length).toBeGreaterThan(0);
  });

  it('should apply jitter to prevent thundering herd', async () => {
    const executionTimes: number[] = [];
    const task = async () => {
      executionTimes.push(Date.now());
    };

    const scheduler = new AsyncScheduler(task, {
      intervalMs: 1000,
      maxJitter: 500
    });
    scheduler.start();

    // Run multiple times
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    }

    scheduler.stop();

    // Verify intervals vary due to jitter
    const intervals: number[] = [];
    for (let i = 1; i < executionTimes.length; i++) {
      const current = executionTimes[i];
      const prev = executionTimes[i - 1];
      if (current !== undefined && prev !== undefined) {
        intervals.push(current - prev);
      }
    }

    // At least some intervals should differ (jitter applied)
    const uniqueIntervals = new Set(intervals);
    expect(uniqueIntervals.size).toBeGreaterThan(1);
  });

  it('should apply exponential backoff on errors', async () => {
    let attemptCount = 0;
    const executionTimes: number[] = [];

    const task = async () => {
      attemptCount++;
      executionTimes.push(Date.now());
      throw new Error('Simulated error');
    };

    const scheduler = new AsyncScheduler(task, {
      intervalMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 8000
    });
    scheduler.start();

    // First attempt
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Second attempt (should be ~2000ms later due to backoff)
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    // Third attempt (should be ~4000ms later)
    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    scheduler.stop();

    expect(attemptCount).toBe(3);

    // Verify backoff intervals
    const first = executionTimes[0] ?? 0;
    const second = executionTimes[1] ?? 0;
    const third = executionTimes[2] ?? 0;
    const intervals = [second - first, third - second];

    expect(intervals[0]).toBeGreaterThanOrEqual(1000);
    expect(intervals[1]).toBeGreaterThanOrEqual(2000);
  });

  it('should reset backoff after successful execution', async () => {
    let shouldFail = true;
    let attemptCount = 0;
    const executionTimes: number[] = [];

    const task = async () => {
      attemptCount++;
      executionTimes.push(Date.now());

      if (shouldFail && attemptCount < 3) {
        throw new Error('Error');
      }
      shouldFail = false;
    };

    const scheduler = new AsyncScheduler(task, {
      intervalMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 8000
    });
    scheduler.start();

    // First attempt - fails
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Second attempt - fails (backoff ~2000ms)
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    // Third attempt - succeeds (backoff should reset)
    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    // Fourth attempt - should be back to normal interval (1000ms)
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    scheduler.stop();

    expect(attemptCount).toBe(4);
  });

  it('should stop scheduling when stopped', async () => {
    let executionCount = 0;
    const task = async () => {
      executionCount++;
    };

    const scheduler = new AsyncScheduler(task, { intervalMs: 100 });
    scheduler.start();

    jest.advanceTimersByTime(300);
    await Promise.resolve();

    scheduler.stop();

    const countAfterStop = executionCount;

    // Advance more time - should not execute
    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(executionCount).toBe(countAfterStop);
  });

  it('should handle task that completes after stop', async () => {
    let taskStarted = false;
    let taskCompleted = false;

    const task = async () => {
      taskStarted = true;
      await new Promise(resolve => setTimeout(resolve, 200));
      taskCompleted = true;
    };

    const scheduler = new AsyncScheduler(task, { intervalMs: 100 });
    scheduler.start();

    jest.advanceTimersByTime(100);
    await Promise.resolve();

    expect(taskStarted).toBe(true);
    expect(taskCompleted).toBe(false);

    scheduler.stop();

    // Let task complete
    jest.advanceTimersByTime(200);
    await Promise.resolve();

    expect(taskCompleted).toBe(true);

    // Should not schedule again
    jest.advanceTimersByTime(500);
    await Promise.resolve();

    // No more executions expected
  });
});
