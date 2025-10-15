import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';

import { ScreenshotError } from '../../core/errors.js';
import {
  MacOSCaptureManager,
  createNativeCaptureManager
} from '../../core/native-capture-manager.js';
import { NativeCaptureOptions, NativeCaptureResult } from '../../types/index.js';

// Mock modules
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('os');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('MacOSCaptureManager', () => {
  let manager: MacOSCaptureManager;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    mockOs.platform.mockReturnValue('darwin');
    mockOs.release.mockReturnValue('23.0.0');

    mockFs.access.mockResolvedValue(undefined);

    mockProcess = createMockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as unknown as ChildProcess);

    manager = new MacOSCaptureManager({
      platform: 'macos',
      enabled: true,
      helperPath: '/test/screencapture-helper'
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (manager) {
      await manager.cleanup();
    }
  });

  describe('Helper Binary Management', () => {
    it('should use custom helper path when provided', async () => {
      const customPath = '/custom/path/screencapture-helper';
      const customManager = new MacOSCaptureManager({
        platform: 'macos',
        enabled: true,
        helperPath: customPath
      });

      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      await customManager.captureRegion({
        region: { x: 0, y: 0, width: 800, height: 600 }
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        customPath,
        [],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      );

      await customManager.cleanup();
    });

    it('should throw error when helper binary not found', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const noHelperManager = new MacOSCaptureManager({
        platform: 'macos',
        enabled: true
      });

      await expect(
        noHelperManager.captureRegion({
          region: { x: 0, y: 0, width: 800, height: 600 }
        })
      ).rejects.toThrow(ScreenshotError);

      await noHelperManager.cleanup();
    });

    it('should throw HELPER_NOT_FOUND error code', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const noHelperManager = new MacOSCaptureManager({
        platform: 'macos',
        enabled: true
      });

      try {
        await noHelperManager.captureRegion({
          region: { x: 0, y: 0, width: 800, height: 600 }
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.code).toBe('HELPER_NOT_FOUND');
      } finally {
        await noHelperManager.cleanup();
      }
    });
  });

  describe('captureRegion', () => {
    it('should capture region successfully', async () => {
      const expectedResult: NativeCaptureResult = {
        filepath: '/test/screenshot.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 524288,
        timestamp: '2025-10-15T10:00:00.000Z',
        metadata: {
          displayId: 1,
          platform: 'macos',
          wasInteractive: false
        }
      };

      mockProcess.emitSuccess(expectedResult);

      const options: NativeCaptureOptions = {
        region: { x: 100, y: 100, width: 800, height: 600 },
        format: 'png',
        quality: 90
      };

      const result = await manager.captureRegion(options);

      expect(result).toEqual(expectedResult);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should throw error when region not provided', async () => {
      await expect(manager.captureRegion({})).rejects.toThrow('Region coordinates are required');
    });

    it('should include region coordinates in command', async () => {
      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      await manager.captureRegion({
        region: { x: 50, y: 75, width: 1920, height: 1080 }
      });

      const writtenData = mockProcess.stdin.writtenData;
      expect(writtenData).toContain('"command":"capture_region"');
      expect(writtenData).toContain('"x":50');
      expect(writtenData).toContain('"y":75');
      expect(writtenData).toContain('"width":1920');
      expect(writtenData).toContain('"height":1080');
    });

    it('should handle Swift error responses', async () => {
      mockProcess.emitError('INVALID_REGION', 'Invalid region coordinates specified');

      await expect(
        manager.captureRegion({
          region: { x: -100, y: -100, width: 800, height: 600 }
        })
      ).rejects.toThrow('Invalid region coordinates');
    });

    it('should convert PERMISSION_DENIED error', async () => {
      mockProcess.emitError('PERMISSION_DENIED', 'Screen Recording permission not granted');

      try {
        await manager.captureRegion({
          region: { x: 0, y: 0, width: 800, height: 600 }
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.code).toBe('PERMISSION_DENIED');
        expect(screenshotError.message).toContain('System Settings');
      }
    });
  });

  describe('captureInteractive', () => {
    it('should capture interactively successfully', async () => {
      const expectedResult: NativeCaptureResult = {
        filepath: '/test/interactive.png',
        width: 1920,
        height: 1080,
        format: 'png',
        size: 1048576,
        timestamp: '2025-10-15T10:00:00.000Z',
        metadata: {
          windowTitle: 'Visual Studio Code',
          appName: 'Code',
          platform: 'macos',
          wasInteractive: true
        }
      };

      mockProcess.emitSuccess(expectedResult);

      const result = await manager.captureInteractive({
        format: 'png',
        quality: 90
      });

      expect(result).toEqual(expectedResult);
      expect(result.metadata?.wasInteractive).toBe(true);
    });

    it('should use interactive command', async () => {
      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      await manager.captureInteractive({ format: 'png' });

      const writtenData = mockProcess.stdin.writtenData;
      expect(writtenData).toContain('"command":"capture_interactive"');
    });

    it('should handle user cancellation', async () => {
      mockProcess.emitError('USER_CANCELLED', 'User cancelled the capture operation');

      try {
        await manager.captureInteractive({ format: 'png' });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.code).toBe('USER_CANCELLED');
        expect(screenshotError.message).toContain('cancelled');
      }
    });

    it('should use higher timeout for interactive mode', async () => {
      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      await manager.captureInteractive({ format: 'png' });

      // Timeout should be at least 30000ms (default interactive timeout)
      const writtenData = mockProcess.stdin.writtenData;
      const commandData = JSON.parse(writtenData.trim());
      expect(commandData.options.timeout).toBeGreaterThanOrEqual(30000);
    });
  });

  describe('IPC Communication', () => {
    it('should send JSON command to stdin', async () => {
      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      await manager.captureRegion({
        region: { x: 0, y: 0, width: 800, height: 600 }
      });

      expect(mockProcess.stdin.write).toHaveBeenCalled();
      expect(mockProcess.stdin.end).toHaveBeenCalled();

      const writtenData = mockProcess.stdin.writtenData;
      const command = JSON.parse(writtenData.trim());
      expect(command).toHaveProperty('command');
      expect(command).toHaveProperty('requestId');
      expect(command).toHaveProperty('options');
    });

    it('should parse JSON response from stdout', async () => {
      const result: NativeCaptureResult = {
        filepath: '/test/output.png',
        width: 1920,
        height: 1080,
        format: 'png',
        size: 524288,
        timestamp: '2025-10-15T10:00:00.000Z'
      };

      mockProcess.emitSuccess(result);

      const capturedResult = await manager.captureRegion({
        region: { x: 0, y: 0, width: 1920, height: 1080 }
      });

      expect(capturedResult).toEqual(result);
    });

    it('should timeout if no response received', async () => {
      // Create a process that never responds
      const silentProcess = createMockChildProcess();
      silentProcess.emitSuccess = () => {
        // Do nothing - simulate timeout
      };
      mockSpawn.mockReturnValue(silentProcess as unknown as ChildProcess);

      await expect(
        manager.captureRegion({
          region: { x: 0, y: 0, width: 800, height: 600 },
          timeout: 100
        })
      ).rejects.toThrow('timeout');
    }, 10000);

    it('should handle spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        const errorProcess = createMockChildProcess();
        setTimeout(() => {
          errorProcess.emit('error', new Error('ENOENT: command not found'));
        }, 10);
        return errorProcess as unknown as ChildProcess;
      });

      await expect(
        manager.captureRegion({
          region: { x: 0, y: 0, width: 800, height: 600 }
        })
      ).rejects.toThrow('Failed to spawn helper process');
    });
  });

  describe('isAvailable', () => {
    it('should return true on macOS with helper available', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const available = await manager.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when helper not found', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const noHelperManager = new MacOSCaptureManager({
        platform: 'macos',
        enabled: true
      });

      const available = await noHelperManager.isAvailable();

      expect(available).toBe(false);

      await noHelperManager.cleanup();
    });

    it('should return false on non-macOS platforms', async () => {
      mockOs.platform.mockReturnValue('win32');

      const windowsManager = new MacOSCaptureManager({
        platform: 'windows',
        enabled: true
      });

      const available = await windowsManager.isAvailable();

      expect(available).toBe(false);

      await windowsManager.cleanup();
    });
  });

  describe('cleanup', () => {
    it('should terminate running process gracefully', async () => {
      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      await manager.captureRegion({
        region: { x: 0, y: 0, width: 800, height: 600 }
      });

      expect(manager['currentProcess']).toBeDefined();

      await manager.cleanup();

      expect(manager['currentProcess']).toBeNull();
    });

    it('should send SIGTERM to running process', async () => {
      // Start a capture but don't let it complete yet
      const capturePromise = manager.captureRegion({
        region: { x: 0, y: 0, width: 800, height: 600 }
      });

      // Wait a bit to ensure process is spawned
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify process is running
      expect(manager['currentProcess']).toBeDefined();

      // Now cleanup while process is still running
      const cleanupPromise = manager.cleanup();

      // Verify kill was called with SIGTERM
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Wait for cleanup to complete
      await cleanupPromise;

      // Verify process was cleared
      expect(manager['currentProcess']).toBeNull();

      // Emit success after cleanup - this will resolve the original capture promise
      mockProcess.emitSuccess({
        filepath: '/test/output.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: '2025-10-15T10:00:00.000Z'
      });

      // Capture promise should resolve since stdout was processed before kill
      await capturePromise;
    });

    it('should be no-op when no process is running', async () => {
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Conversion', () => {
    const errorTestCases = [
      {
        swiftCode: 'PERMISSION_DENIED',
        expectedCode: 'PERMISSION_DENIED',
        expectedMessage: 'Screen Recording permission'
      },
      { swiftCode: 'USER_CANCELLED', expectedCode: 'USER_CANCELLED', expectedMessage: 'cancelled' },
      { swiftCode: 'TIMEOUT', expectedCode: 'TIMEOUT', expectedMessage: 'timed out' },
      {
        swiftCode: 'INVALID_REGION',
        expectedCode: 'INVALID_REGION',
        expectedMessage: 'Invalid region'
      },
      {
        swiftCode: 'DISPLAY_NOT_FOUND',
        expectedCode: 'DISPLAY_NOT_FOUND',
        expectedMessage: 'does not exist'
      },
      {
        swiftCode: 'CAPTURE_FAILED',
        expectedCode: 'CAPTURE_FAILED',
        expectedMessage: 'capture failed'
      },
      {
        swiftCode: 'ENCODING_FAILED',
        expectedCode: 'ENCODING_FAILED',
        expectedMessage: 'encoding failed'
      },
      {
        swiftCode: 'FILE_WRITE_ERROR',
        expectedCode: 'FILE_WRITE_ERROR',
        expectedMessage: 'write output file'
      }
    ];

    errorTestCases.forEach(({ swiftCode, expectedCode, expectedMessage }) => {
      it(`should convert ${swiftCode} error correctly`, async () => {
        mockProcess.emitError(swiftCode, `${swiftCode} occurred`);

        try {
          await manager.captureRegion({
            region: { x: 0, y: 0, width: 800, height: 600 }
          });
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ScreenshotError);
          const screenshotError = error as ScreenshotError;
          expect(screenshotError.code).toBe(expectedCode);
          expect(screenshotError.message.toLowerCase()).toContain(expectedMessage.toLowerCase());
        }
      });
    });
  });

  describe('createNativeCaptureManager', () => {
    it('should create MacOSCaptureManager on macOS 14+', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.release.mockReturnValue('23.0.0');

      const captureManager = createNativeCaptureManager();

      expect(captureManager).toBeInstanceOf(MacOSCaptureManager);
    });

    it('should create UnsupportedPlatformCaptureManager on old macOS', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.release.mockReturnValue('22.0.0');

      const captureManager = createNativeCaptureManager();

      expect(captureManager).not.toBeInstanceOf(MacOSCaptureManager);
      expect(captureManager.constructor.name).toBe('UnsupportedPlatformCaptureManager');
    });

    it('should create UnsupportedPlatformCaptureManager on Windows', () => {
      mockOs.platform.mockReturnValue('win32');

      const captureManager = createNativeCaptureManager();

      expect(captureManager).not.toBeInstanceOf(MacOSCaptureManager);
    });

    it('should pass config to MacOSCaptureManager', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.release.mockReturnValue('23.0.0');

      const config = {
        helperPath: '/custom/path/screencapture-helper'
      };

      const captureManager = createNativeCaptureManager(config);

      expect(captureManager).toBeInstanceOf(MacOSCaptureManager);
    });
  });
});

// Test helpers
interface MockChildProcess extends EventEmitter {
  stdin: {
    write: jest.Mock;
    end: jest.Mock;
    writtenData: string;
  };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
  emitSuccess: (result: NativeCaptureResult) => void;
  emitError: (code: string, message: string) => void;
}

function createMockChildProcess(): MockChildProcess {
  const process = new EventEmitter() as MockChildProcess;

  let writtenData = '';

  process.stdin = {
    write: jest.fn((data: string) => {
      writtenData += data;
      return true;
    }),
    end: jest.fn(),
    get writtenData() {
      return writtenData;
    }
  };

  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  process.kill = jest.fn((signal: string) => {
    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
      setTimeout(() => {
        process.emit('exit', 0);
      }, 10);
    }
    return true;
  });

  process.emitSuccess = (result: NativeCaptureResult) => {
    setTimeout(() => {
      const response = {
        success: true,
        requestId: 'mock-request-id',
        result
      };
      process.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      process.emit('close', 0);
    }, 10);
  };

  process.emitError = (code: string, message: string) => {
    setTimeout(() => {
      const response = {
        success: false,
        requestId: 'mock-request-id',
        error: {
          code,
          message
        }
      };
      process.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      process.emit('close', 0);
    }, 10);
  };

  return process;
}
