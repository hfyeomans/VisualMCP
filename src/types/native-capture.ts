/**
 * Native desktop capture types for platform-specific screenshot implementations
 * Currently supports macOS ScreenCaptureKit with plans for Windows/Linux
 */

export interface NativeCaptureOptions {
  /**
   * Enable interactive mode (user selects window/region via picker UI)
   * @default true
   */
  interactive?: boolean;

  /**
   * Specific display ID to capture (non-interactive mode)
   */
  displayId?: number;

  /**
   * Specific window ID to capture (non-interactive mode)
   */
  windowId?: number;

  /**
   * Region coordinates for desktop capture
   */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /**
   * Output image format
   * @default 'png'
   */
  format?: 'png' | 'jpeg';

  /**
   * JPEG quality (1-100, only applies to JPEG format)
   * @default 90
   */
  quality?: number;

  /**
   * Output file path (if not specified, manager generates one)
   */
  outputPath?: string;

  /**
   * Timeout in milliseconds for capture operation
   * @default 30000
   */
  timeout?: number;
}

export interface NativeCaptureResult {
  /** Absolute path to captured screenshot file */
  filepath: string;

  /** Image width in pixels */
  width: number;

  /** Image height in pixels */
  height: number;

  /** Image format */
  format: 'png' | 'jpeg';

  /** File size in bytes */
  size: number;

  /** ISO timestamp of capture */
  timestamp: string;

  /** Platform-specific metadata about the capture */
  metadata?: {
    /** Display ID (if applicable) */
    displayId?: number;

    /** Window title (if window capture) */
    windowTitle?: string;

    /** Application name (if window capture) */
    appName?: string;

    /** Platform identifier */
    platform?: 'macos' | 'windows' | 'linux';

    /** Whether capture was interactive */
    wasInteractive?: boolean;
  };
}

/**
 * Platform identifier for native capture support
 */
export type NativeCapturePlatform = 'macos' | 'windows' | 'linux' | 'none';

/**
 * Configuration for native capture manager
 */
export interface NativeCaptureConfig {
  /**
   * Enable native capture functionality
   * @default true on macOS, false otherwise
   */
  enabled: boolean;

  /**
   * Path to platform-specific capture helper executable
   * For macOS: path to Swift ScreenCaptureKit helper
   */
  helperPath?: string;

  /**
   * Current platform
   */
  platform: NativeCapturePlatform;

  /**
   * Default timeout for capture operations (ms)
   * @default 30000
   */
  defaultTimeout?: number;
}
