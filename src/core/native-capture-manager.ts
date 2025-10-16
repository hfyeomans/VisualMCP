import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { constants as fsConstants } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { INativeCaptureManager } from '../interfaces/index.js';
import { NativeCaptureOptions, NativeCaptureResult, NativeCaptureConfig } from '../types/index.js';

import { ScreenshotError } from './errors.js';
import { createLogger } from './logger.js';

const logger = createLogger('NativeCaptureManager');

/**
 * Swift IPC command request structure
 */
interface SwiftCommand {
  command: string;
  requestId: string;
  options?: Record<string, unknown>;
}

/**
 * Swift IPC response structure
 */
interface SwiftResponse<T = unknown> {
  success: boolean;
  requestId: string;
  result?: T;
  error?: SwiftErrorDetail;
}

/**
 * Swift error details
 */
interface SwiftErrorDetail {
  code: string;
  message: string;
  details?: Record<string, string>;
}

/**
 * macOS-specific native capture manager using ScreenCaptureKit
 *
 * This manager handles communication with a Swift CLI helper that uses
 * Apple's ScreenCaptureKit framework for high-performance desktop capture.
 *
 * Architecture:
 * - TypeScript (this class) spawns Swift helper as child process
 * - JSON-based IPC over stdin/stdout for commands and responses
 * - Swift helper uses ScreenCaptureKit APIs for actual capture
 * - Supports interactive picker UI and programmatic capture
 *
 * @see tasks/phase-6-region-capture/sub-phase-2-design.md
 */
export class MacOSCaptureManager extends EventEmitter implements INativeCaptureManager {
  private platform: string;
  private helperPath: string;
  private currentProcess: ChildProcess | null = null;
  private readonly HELPER_BINARY_NAME = 'screencapture-helper';
  private readonly DEFAULT_REGION_TIMEOUT = 10000;
  private readonly DEFAULT_INTERACTIVE_TIMEOUT = 30000;

  constructor(config?: Partial<NativeCaptureConfig>) {
    super();
    this.platform = os.platform();
    this.helperPath = config?.helperPath || '';

    logger.debug('MacOSCaptureManager initialized', {
      platform: this.platform,
      isDarwin: this.platform === 'darwin',
      customHelperPath: !!config?.helperPath
    });
  }

  /**
   * Find helper binary in multiple possible locations
   */
  private async findHelperBinary(): Promise<string> {
    if (this.helperPath) {
      try {
        await fs.access(this.helperPath, fsConstants.X_OK);
        logger.debug('Using custom helper path', { path: this.helperPath });
        return this.helperPath;
      } catch (error) {
        logger.warn('Custom helper path not accessible', {
          path: this.helperPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Try multiple possible locations for the helper binary
    const locations = [
      // Global npm install (from dist/core/ to bin/)
      path.join(__dirname, '../../bin', this.HELPER_BINARY_NAME),
      // Relative to current working directory
      path.join(process.cwd(), 'bin', this.HELPER_BINARY_NAME),
      path.join(process.cwd(), 'screencapture-helper/.build/release', this.HELPER_BINARY_NAME),
      path.join(process.cwd(), 'screencapture-helper/.build/debug', this.HELPER_BINARY_NAME),
      // In node_modules
      path.join(process.cwd(), 'node_modules/@visualmcp/visual-mcp-server/bin', this.HELPER_BINARY_NAME),
      // System-wide installation
      `/usr/local/bin/${this.HELPER_BINARY_NAME}`
    ];

    for (const location of locations) {
      try {
        await fs.access(location, fsConstants.X_OK);
        logger.debug('Found helper binary', { location });
        return location;
      } catch {
        // Try next location
      }
    }

    throw new ScreenshotError(
      `${this.HELPER_BINARY_NAME} not found. Searched locations: ${locations.join(', ')}. ` +
        'Please ensure the Swift helper is built and installed correctly.',
      'HELPER_NOT_FOUND'
    );
  }

  /**
   * Ensure helper binary is available and executable
   */
  private async ensureHelperAvailable(): Promise<void> {
    if (!this.helperPath) {
      this.helperPath = await this.findHelperBinary();
    }

    try {
      await fs.access(this.helperPath, fsConstants.X_OK);
    } catch (error) {
      throw new ScreenshotError(
        `Helper binary not executable: ${this.helperPath}. Error: ${error instanceof Error ? error.message : String(error)}`,
        'HELPER_NOT_EXECUTABLE'
      );
    }
  }

  /**
   * Generate unique request ID for IPC correlation
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Execute a command via the Swift helper and get response
   */
  private async executeCommand<T>(
    command: SwiftCommand,
    timeout: number
  ): Promise<SwiftResponse<T>> {
    await this.ensureHelperAvailable();

    return new Promise((resolve, reject) => {
      const process = spawn(this.helperPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentProcess = process;

      let stdoutData = '';
      let stderrData = '';

      const timer = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new ScreenshotError(`Helper process timeout after ${timeout}ms`, 'TIMEOUT'));
      }, timeout + 1000);

      process.stdout?.on('data', (data: Buffer) => {
        stdoutData += data.toString();
      });

      process.stderr?.on('data', (data: Buffer) => {
        stderrData += data.toString();
        logger.debug('Helper stderr', { output: data.toString() });
      });

      process.on('close', (code: number | null) => {
        clearTimeout(timer);
        this.currentProcess = null;

        if (code !== 0) {
          reject(
            new ScreenshotError(
              `Helper process exited with code ${code}. stderr: ${stderrData}`,
              'HELPER_PROCESS_ERROR'
            )
          );
          return;
        }

        try {
          const lines = stdoutData.trim().split('\n');
          const responseLine = lines.find(line => {
            if (!line.trim()) return false;
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              return parsed.success !== undefined;
            } catch {
              return false;
            }
          });

          if (!responseLine) {
            reject(
              new ScreenshotError(
                `No valid response from helper. stdout: ${stdoutData}`,
                'INVALID_RESPONSE'
              )
            );
            return;
          }

          const response = JSON.parse(responseLine) as SwiftResponse<T>;
          resolve(response);
        } catch (error) {
          reject(
            new ScreenshotError(
              `Failed to parse helper response: ${error instanceof Error ? error.message : String(error)}. stdout: ${stdoutData}`,
              'INVALID_RESPONSE'
            )
          );
        }
      });

      process.on('error', (error: Error) => {
        clearTimeout(timer);
        this.currentProcess = null;
        reject(
          new ScreenshotError(`Failed to spawn helper process: ${error.message}`, 'SPAWN_FAILED')
        );
      });

      process.stdin?.write(JSON.stringify(command) + '\n');
      process.stdin?.end();
    });
  }

  /**
   * Convert Swift error to ScreenshotError
   */
  private convertSwiftError(error: SwiftErrorDetail): ScreenshotError {
    const errorMap: Record<string, { code: string; message: string }> = {
      PERMISSION_DENIED: {
        code: 'PERMISSION_DENIED',
        message:
          'Screen Recording permission is required for desktop capture. ' +
          'Please grant permission in System Settings > Privacy & Security > Screen Recording'
      },
      USER_CANCELLED: {
        code: 'USER_CANCELLED',
        message: 'User cancelled the capture operation'
      },
      TIMEOUT: {
        code: 'TIMEOUT',
        message: 'Capture operation timed out'
      },
      INVALID_REGION: {
        code: 'INVALID_REGION',
        message: 'Invalid region coordinates specified'
      },
      DISPLAY_NOT_FOUND: {
        code: 'DISPLAY_NOT_FOUND',
        message: 'Specified display does not exist'
      },
      WINDOW_NOT_FOUND: {
        code: 'WINDOW_NOT_FOUND',
        message: 'Specified window does not exist or has closed'
      },
      CAPTURE_FAILED: {
        code: 'CAPTURE_FAILED',
        message: 'Screen capture failed. Please check system resources and permissions.'
      },
      ENCODING_FAILED: {
        code: 'ENCODING_FAILED',
        message: 'Image encoding failed. Try a different format.'
      },
      FILE_WRITE_ERROR: {
        code: 'FILE_WRITE_ERROR',
        message: 'Failed to write output file. Check disk space and permissions.'
      }
    };

    const mapped = errorMap[error.code];
    if (mapped) {
      return new ScreenshotError(mapped.message, mapped.code);
    }

    return new ScreenshotError(
      error.message || 'Unknown capture error',
      error.code || 'UNKNOWN_ERROR'
    );
  }

  /**
   * Capture screenshot interactively - user selects window/region via macOS picker UI
   */
  async captureInteractive(options: NativeCaptureOptions): Promise<NativeCaptureResult> {
    logger.debug('Interactive capture requested', {
      format: options.format,
      quality: options.quality,
      timeout: options.timeout
    });

    const requestId = this.generateRequestId();
    const timeout = options.timeout || this.DEFAULT_INTERACTIVE_TIMEOUT;

    const command: SwiftCommand = {
      command: 'capture_interactive',
      requestId,
      options: {
        format: options.format || 'png',
        quality: options.quality || 90,
        outputPath: options.outputPath,
        timeout
      }
    };

    try {
      const response = await this.executeCommand<NativeCaptureResult>(command, timeout);

      if (!response.success) {
        if (response.error) {
          throw this.convertSwiftError(response.error);
        }
        throw new ScreenshotError('Interactive capture failed', 'CAPTURE_FAILED');
      }

      if (!response.result) {
        throw new ScreenshotError('No result returned from helper', 'INVALID_RESPONSE');
      }

      logger.info('Interactive capture successful', {
        filepath: response.result.filepath,
        width: response.result.width,
        height: response.result.height
      });

      return response.result;
    } catch (error) {
      if (error instanceof ScreenshotError) {
        throw error;
      }
      throw new ScreenshotError(
        `Interactive capture failed: ${error instanceof Error ? error.message : String(error)}`,
        'CAPTURE_FAILED'
      );
    }
  }

  /**
   * Capture a specific desktop region by coordinates
   */
  async captureRegion(options: NativeCaptureOptions): Promise<NativeCaptureResult> {
    if (!options.region) {
      throw new ScreenshotError(
        'Region coordinates are required for region capture',
        'INVALID_OPTIONS'
      );
    }

    logger.debug('Region capture requested', {
      region: options.region,
      displayId: options.displayId,
      format: options.format,
      quality: options.quality
    });

    const requestId = this.generateRequestId();
    const timeout = options.timeout || this.DEFAULT_REGION_TIMEOUT;

    const command: SwiftCommand = {
      command: 'capture_region',
      requestId,
      options: {
        region: options.region,
        displayId: options.displayId || 1,
        format: options.format || 'png',
        quality: options.quality || 90,
        outputPath: options.outputPath,
        timeout
      }
    };

    try {
      const response = await this.executeCommand<NativeCaptureResult>(command, timeout);

      if (!response.success) {
        if (response.error) {
          throw this.convertSwiftError(response.error);
        }
        throw new ScreenshotError('Region capture failed', 'CAPTURE_FAILED');
      }

      if (!response.result) {
        throw new ScreenshotError('No result returned from helper', 'INVALID_RESPONSE');
      }

      logger.info('Region capture successful', {
        filepath: response.result.filepath,
        width: response.result.width,
        height: response.result.height
      });

      return response.result;
    } catch (error) {
      if (error instanceof ScreenshotError) {
        throw error;
      }
      throw new ScreenshotError(
        `Region capture failed: ${error instanceof Error ? error.message : String(error)}`,
        'CAPTURE_FAILED'
      );
    }
  }

  /**
   * Check if native capture is available on this platform
   */
  async isAvailable(): Promise<boolean> {
    if (this.platform !== 'darwin') {
      logger.debug('Native capture not available', { platform: this.platform });
      return false;
    }

    try {
      await this.ensureHelperAvailable();
      logger.debug('Native capture available', { helperPath: this.helperPath });
      return true;
    } catch (error) {
      logger.warn('Native capture not available', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get the current platform identifier
   */
  getPlatform(): string {
    return this.platform === 'darwin' ? 'macos' : 'none';
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (!this.currentProcess) {
      return;
    }

    logger.info('Cleaning up MacOSCaptureManager');

    const process = this.currentProcess;
    this.currentProcess = null;

    return new Promise<void>(resolve => {
      const forceKillTimer = setTimeout(() => {
        logger.warn('Force killing helper process');
        process.kill('SIGKILL');
        resolve();
      }, 2000);

      process.once('exit', () => {
        clearTimeout(forceKillTimer);
        logger.debug('Helper process exited gracefully');
        resolve();
      });

      process.kill('SIGTERM');
    });
  }
}

/**
 * Stub implementation for non-macOS platforms
 * Always throws errors indicating the platform is not supported
 */
export class UnsupportedPlatformCaptureManager
  extends EventEmitter
  implements INativeCaptureManager
{
  private platform: string;

  constructor() {
    super();
    this.platform = os.platform();

    logger.debug('UnsupportedPlatformCaptureManager initialized', {
      platform: this.platform
    });
  }

  async captureInteractive(_options: NativeCaptureOptions): Promise<NativeCaptureResult> {
    throw new ScreenshotError(
      `Native desktop capture is not supported on ${this.platform}. ` +
        'Currently only macOS (via ScreenCaptureKit) is supported. ' +
        'Use URL-based screenshots (target.type = "url") as an alternative.',
      'PLATFORM_NOT_SUPPORTED'
    );
  }

  async captureRegion(_options: NativeCaptureOptions): Promise<NativeCaptureResult> {
    const platformName = this.getPlatform();
    throw new ScreenshotError(
      `Native desktop capture is not supported on ${platformName}. ` +
        'Currently only macOS (via ScreenCaptureKit) is supported. ' +
        'Use URL-based screenshots (target.type = "url") as an alternative.',
      'PLATFORM_NOT_SUPPORTED'
    );
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  getPlatform(): string {
    // Map os.platform() to proper platform names (P2 fix)
    switch (this.platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos'; // Should not reach here (MacOSCaptureManager handles darwin)
      case 'linux':
        return 'linux';
      default:
        return 'none';
    }
  }

  async cleanup(): Promise<void> {
    // No-op for unsupported platforms
  }
}

/**
 * Factory function to create appropriate native capture manager for current platform
 *
 * @param config Optional configuration for the capture manager
 * @returns MacOSCaptureManager on macOS 14+, UnsupportedPlatformCaptureManager otherwise
 */
export function createNativeCaptureManager(
  config?: Partial<NativeCaptureConfig>
): INativeCaptureManager {
  const platform = os.platform();

  if (platform === 'darwin') {
    const release = os.release();
    const versionParts = release.split('.');
    const majorVersion = versionParts[0] ? parseInt(versionParts[0], 10) : 0;

    if (majorVersion >= 23) {
      logger.info('Creating MacOSCaptureManager for macOS 14+ (Sonoma)', {
        darwinVersion: majorVersion,
        customHelperPath: !!config?.helperPath
      });
      return new MacOSCaptureManager(config);
    }

    logger.warn('macOS version too old for ScreenCaptureKit', {
      darwinVersion: majorVersion,
      required: 23
    });
    return new UnsupportedPlatformCaptureManager();
  }

  logger.info('Creating UnsupportedPlatformCaptureManager', { platform });
  return new UnsupportedPlatformCaptureManager();
}
