import { EventEmitter } from 'events';
import os from 'os';

import { INativeCaptureManager } from '../interfaces/index.js';
import { NativeCaptureOptions, NativeCaptureResult } from '../types/index.js';

import { ScreenshotError } from './errors.js';
import { createLogger } from './logger.js';

const logger = createLogger('NativeCaptureManager');

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
  private isInitialized = false;

  constructor() {
    super();
    this.platform = os.platform();

    logger.debug('MacOSCaptureManager initialized', {
      platform: this.platform,
      isDarwin: this.platform === 'darwin'
    });
  }

  /**
   * Capture screenshot interactively - user selects window/region via macOS picker UI
   *
   * Phase 6.2: Stub implementation - throws not implemented error
   * Phase 6.3+: Will spawn Swift helper with interactive mode enabled
   */
  async captureInteractive(_options: NativeCaptureOptions): Promise<NativeCaptureResult> {
    logger.warn('Interactive capture called but not yet implemented');

    throw new ScreenshotError(
      'Interactive desktop capture not yet implemented. ' +
        'This feature requires Swift ScreenCaptureKit helper (Phase 6.3). ' +
        'Current Phase 6.2 provides the interface and integration layer only.',
      'NATIVE_CAPTURE_NOT_IMPLEMENTED'
    );
  }

  /**
   * Capture a specific desktop region by coordinates
   *
   * Phase 6.2: Stub implementation - throws not implemented error
   * Phase 6.3+: Will spawn Swift helper with specific region coordinates
   */
  async captureRegion(_region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<NativeCaptureResult> {
    logger.warn('Region capture called but not yet implemented');

    throw new ScreenshotError(
      'Desktop region capture not yet implemented. ' +
        'This feature requires Swift ScreenCaptureKit helper (Phase 6.3). ' +
        'Current Phase 6.2 provides the interface and integration layer only.',
      'NATIVE_CAPTURE_NOT_IMPLEMENTED'
    );
  }

  /**
   * Check if native capture is available on this platform
   *
   * Returns true only on macOS (darwin platform)
   * Future: May check for Swift helper existence and Screen Recording permissions
   */
  async isAvailable(): Promise<boolean> {
    // Phase 6.2: Only check platform
    // Phase 6.3+: Also check for Swift helper binary and permissions
    const available = this.platform === 'darwin';

    logger.debug('Checked native capture availability', {
      platform: this.platform,
      available
    });

    return available;
  }

  /**
   * Get the current platform identifier
   */
  getPlatform(): string {
    return this.platform === 'darwin' ? 'macos' : 'none';
  }

  /**
   * Cleanup resources
   *
   * Phase 6.2: No-op (no resources yet)
   * Phase 6.3+: Will terminate Swift helper process if running
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Cleaning up MacOSCaptureManager');

    // Phase 6.3+: Kill helper process, clear resources

    this.isInitialized = false;
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

  async captureRegion(_region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<NativeCaptureResult> {
    throw new ScreenshotError(
      `Native desktop capture is not supported on ${this.platform}. ` +
        'Currently only macOS (via ScreenCaptureKit) is supported. ' +
        'Use URL-based screenshots (target.type = "url") as an alternative.',
      'PLATFORM_NOT_SUPPORTED'
    );
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  getPlatform(): string {
    return 'none';
  }

  async cleanup(): Promise<void> {
    // No-op for unsupported platforms
  }
}

/**
 * Factory function to create appropriate native capture manager for current platform
 *
 * @returns MacOSCaptureManager on macOS, UnsupportedPlatformCaptureManager otherwise
 */
export function createNativeCaptureManager(): INativeCaptureManager {
  const platform = os.platform();

  if (platform === 'darwin') {
    logger.info('Creating MacOSCaptureManager for macOS platform');
    return new MacOSCaptureManager();
  }

  logger.info('Creating UnsupportedPlatformCaptureManager', { platform });
  return new UnsupportedPlatformCaptureManager();
}
