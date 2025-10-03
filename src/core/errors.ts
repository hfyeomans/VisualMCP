/**
 * Base error class for Visual MCP errors
 */
export abstract class VisualMCPError extends Error {
  public readonly code: string;
  public readonly component: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    component: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.component = component;
    this.timestamp = new Date().toISOString();

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      component: this.component,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

/**
 * Screenshot-related errors
 */
export class ScreenshotError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'ScreenshotEngine', cause);
  }
}

export class ScreenshotTimeoutError extends ScreenshotError {
  constructor(url: string, timeout: number, cause?: Error) {
    super(`Screenshot timeout after ${timeout}ms for URL: ${url}`, 'SCREENSHOT_TIMEOUT', cause);
  }
}

export class ScreenshotNavigationError extends ScreenshotError {
  constructor(url: string, cause?: Error) {
    super(`Failed to navigate to URL: ${url}`, 'SCREENSHOT_NAVIGATION_ERROR', cause);
  }
}

export class ScreenshotCaptureError extends ScreenshotError {
  constructor(reason: string, cause?: Error) {
    super(`Failed to capture screenshot: ${reason}`, 'SCREENSHOT_CAPTURE_ERROR', cause);
  }
}

/**
 * Comparison-related errors
 */
export class ComparisonError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'ComparisonEngine', cause);
  }
}

export class ImageLoadError extends ComparisonError {
  constructor(imagePath: string, cause?: Error) {
    super(`Failed to load image: ${imagePath}`, 'IMAGE_LOAD_ERROR', cause);
  }
}

export class ImageFormatError extends ComparisonError {
  constructor(imagePath: string, expectedFormat?: string, cause?: Error) {
    const formatInfo = expectedFormat ? ` (expected: ${expectedFormat})` : '';
    super(`Invalid image format: ${imagePath}${formatInfo}`, 'IMAGE_FORMAT_ERROR', cause);
  }
}

export class ImageSizeMismatchError extends ComparisonError {
  constructor(
    currentSize: { width: number; height: number },
    referenceSize: { width: number; height: number }
  ) {
    super(
      `Image size mismatch: current(${currentSize.width}x${currentSize.height}) vs reference(${referenceSize.width}x${referenceSize.height})`,
      'IMAGE_SIZE_MISMATCH'
    );
  }
}

/**
 * Analysis-related errors
 */
export class AnalysisError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'AnalysisEngine', cause);
  }
}

export class DiffImageNotFoundError extends AnalysisError {
  constructor(diffImagePath: string) {
    super(`Diff image not found: ${diffImagePath}`, 'DIFF_IMAGE_NOT_FOUND');
  }
}

/**
 * Monitoring-related errors
 */
export class MonitoringError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'MonitoringManager', cause);
  }
}

export class SessionNotFoundError extends MonitoringError {
  constructor(sessionId: string) {
    super(`Monitoring session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
  }
}

export class SessionLimitExceededError extends MonitoringError {
  constructor(maxSessions: number) {
    super(
      `Maximum number of monitoring sessions exceeded: ${maxSessions}`,
      'SESSION_LIMIT_EXCEEDED'
    );
  }
}

export class ReferenceImageNotFoundError extends MonitoringError {
  constructor(referenceImagePath: string) {
    super(`Reference image not found: ${referenceImagePath}`, 'REFERENCE_IMAGE_NOT_FOUND');
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'ConfigManager', cause);
  }
}

export class InvalidConfigurationError extends ConfigurationError {
  constructor(field: string, value: unknown, reason: string) {
    super(`Invalid configuration for ${field}: ${value} - ${reason}`, 'INVALID_CONFIGURATION');
  }
}

/**
 * File system related errors
 */
export class FileSystemError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'FileSystem', cause);
  }
}

export class DirectoryCreationError extends FileSystemError {
  constructor(path: string, cause?: Error) {
    super(`Failed to create directory: ${path}`, 'DIRECTORY_CREATION_ERROR', cause);
  }
}

export class FileWriteError extends FileSystemError {
  constructor(path: string, cause?: Error) {
    super(`Failed to write file: ${path}`, 'FILE_WRITE_ERROR', cause);
  }
}

export class FileReadError extends FileSystemError {
  constructor(path: string, cause?: Error) {
    super(`Failed to read file: ${path}`, 'FILE_READ_ERROR', cause);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends VisualMCPError {
  constructor(message: string, field?: string, cause?: Error) {
    super(
      field ? `Validation error for ${field}: ${message}` : `Validation error: ${message}`,
      'VALIDATION_ERROR',
      'Validator',
      cause
    );
  }
}

/**
 * Browser-related errors
 */
export class BrowserError extends VisualMCPError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, 'BrowserManager', cause);
  }
}

export class BrowserLaunchError extends BrowserError {
  constructor(cause?: Error) {
    super('Failed to launch browser', 'BROWSER_LAUNCH_ERROR', cause);
  }
}

export class BrowserConnectionError extends BrowserError {
  constructor(cause?: Error) {
    super('Failed to connect to browser', 'BROWSER_CONNECTION_ERROR', cause);
  }
}

/**
 * Utility function to determine if an error is a Visual MCP error
 */
export function isVisualMCPError(error: unknown): error is VisualMCPError {
  return error instanceof VisualMCPError;
}

/**
 * Utility function to wrap unknown errors
 */
export function wrapError(
  error: unknown,
  component: string,
  code: string = 'UNKNOWN_ERROR'
): VisualMCPError {
  if (isVisualMCPError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new (class extends VisualMCPError {
    constructor() {
      super(message, code, component, cause);
    }
  })();
}
