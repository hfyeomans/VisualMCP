import {
  ScreenshotTarget,
  ScreenshotOptions,
  ScreenshotResult,
  ComparisonOptions,
  ComparisonResult,
  FeedbackOptions,
  FeedbackResult,
  MonitoringSession,
  MonitoringSummary,
  StartMonitoringParams,
  NativeCaptureOptions,
  NativeCaptureResult
} from '../types/index.js';

/**
 * Interface for screenshot capture functionality
 */
export interface IScreenshotEngine {
  init(): Promise<void>;
  takeScreenshot(target: ScreenshotTarget, options?: ScreenshotOptions): Promise<ScreenshotResult>;
  listScreenshots(): Promise<string[]>;
  deleteScreenshot(filepath: string): Promise<boolean>;
  getOutputDirectory(): string;
  setOutputDirectory(dir: string): void;
  cleanup(): Promise<void>;
}

/**
 * Interface for image comparison functionality
 */
export interface IComparisonEngine {
  init(): Promise<void>;
  compare(
    currentImagePath: string,
    referenceImagePath: string,
    options?: ComparisonOptions
  ): Promise<ComparisonResult>;
  listComparisons(): Promise<string[]>;
  deleteComparison(filepath: string): Promise<boolean>;
  getOutputDirectory(): string;
  setOutputDirectory(dir: string): void;
}

/**
 * Interface for feedback analysis functionality
 */
export interface IFeedbackAnalyzer {
  analyzeDifferences(diffImagePath: string, options?: FeedbackOptions): Promise<FeedbackResult>;
}

/**
 * Interface for monitoring functionality
 */
export interface IMonitoringManager {
  startMonitoring(params: StartMonitoringParams): Promise<string>;
  stopMonitoring(sessionId: string): Promise<MonitoringSummary>;
  pauseMonitoring(sessionId: string): Promise<boolean>;
  resumeMonitoring(sessionId: string): Promise<boolean>;
  getActiveMonitoringSessions(): Promise<MonitoringSession[]>;
  getMonitoringSession(sessionId: string): Promise<MonitoringSession | null>;
  getAllMonitoringSessions(): Promise<MonitoringSession[]>;
  cleanup(): Promise<void>;
}

/**
 * Interface for browser management
 */
export interface IBrowserManager {
  getBrowser(): Promise<unknown>; // Browser from puppeteer
  createPage(): Promise<unknown>; // Page from puppeteer
  closePage(page: unknown): Promise<void>;
  cleanup(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

/**
 * Interface for native desktop capture management
 * Platform-specific implementations (macOS ScreenCaptureKit, Windows, Linux)
 */
export interface INativeCaptureManager {
  /**
   * Capture screenshot interactively (user selects window/region via picker UI)
   */
  captureInteractive(options: NativeCaptureOptions): Promise<NativeCaptureResult>;

  /**
   * Capture a specific desktop region by coordinates
   */
  captureRegion(region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<NativeCaptureResult>;

  /**
   * Check if native capture is available on this platform
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the current platform identifier
   */
  getPlatform(): string;

  /**
   * Cleanup resources (close helper processes, etc.)
   */
  cleanup(): Promise<void>;
}

/**
 * Interface for image processing utilities
 */
export interface IImageProcessor {
  loadImage(imagePath: string): Promise<unknown>;
  saveImage(imageData: unknown, outputPath: string): Promise<void>;
  resizeImage(imagePath: string, width: number, height: number): Promise<string>;
  convertFormat(imagePath: string, format: 'png' | 'jpeg', outputPath?: string): Promise<string>;
  getImageMetadata(imagePath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }>;
  prepareImagesForComparison(
    currentImagePath: string,
    referenceImagePath: string
  ): Promise<{
    current: { path: string; isTemporary: boolean };
    reference: { path: string; isTemporary: boolean };
  }>;
}

/**
 * Interface for file operations
 */
export interface IFileManager {
  ensureDirectory(path: string): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer | string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(directory: string, extension?: string): Promise<string[]>;
  getFileStats(path: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
  }>;
}

/**
 * Interface for event handling
 */
export interface IEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  removeAllListeners(event?: string): void;
}

/**
 * Interface for caching functionality
 */
export interface ICache<K, V> {
  get(key: K): Promise<V | undefined>;
  set(key: K, value: V, ttl?: number): Promise<void>;
  delete(key: K): Promise<boolean>;
  clear(): Promise<void>;
  has(key: K): Promise<boolean>;
  size(): Promise<number>;
}

/**
 * Interface for metrics collection
 */
export interface IMetricsCollector {
  incrementCounter(name: string, labels?: Record<string, string>): void;
  recordDuration(name: string, duration: number, labels?: Record<string, string>): void;
  recordValue(name: string, value: number, labels?: Record<string, string>): void;
  getMetrics(): Promise<Record<string, unknown>>;
}

/**
 * Interface for health checking
 */
export interface IHealthChecker {
  checkHealth(): Promise<HealthStatus>;
  registerCheck(name: string, check: () => Promise<boolean>): void;
  removeCheck(name: string): void;
}

export interface HealthStatus {
  healthy: boolean;
  checks: Record<
    string,
    {
      status: 'pass' | 'fail';
      message?: string;
      timestamp: string;
    }
  >;
  uptime: number;
  version: string;
}

/**
 * Interface for resource cleanup
 */
export interface ICleanupManager {
  registerCleanupHandler(name: string, handler: () => Promise<void>): void;
  removeCleanupHandler(name: string): void;
  cleanup(): Promise<void>;
}

/**
 * Interface for validation
 */
export interface IValidator<T> {
  validate(data: unknown): Promise<T>;
  isValid(data: unknown): Promise<boolean>;
  getErrors(data: unknown): Promise<string[]>;
}

/**
 * Interface for plugin system
 */
export interface IPlugin {
  name: string;
  version: string;
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  isEnabled(): boolean;
}

export interface IPluginManager {
  registerPlugin(plugin: IPlugin): Promise<void>;
  unregisterPlugin(name: string): Promise<void>;
  getPlugin(name: string): IPlugin | undefined;
  listPlugins(): IPlugin[];
  initializeAll(): Promise<void>;
  destroyAll(): Promise<void>;
}

/**
 * Interface for dependency injection container
 */
export interface IDependencyContainer {
  register<T>(key: string | symbol, factory: () => T): void;
  registerSingleton<T>(key: string | symbol, factory: () => T): void;
  resolve<T>(key: string | symbol): T;
  isRegistered(key: string | symbol): boolean;
}

/**
 * Service tokens for dependency injection
 */
export const SERVICE_TOKENS = {
  SCREENSHOT_ENGINE: Symbol('ScreenshotEngine'),
  COMPARISON_ENGINE: Symbol('ComparisonEngine'),
  FEEDBACK_ANALYZER: Symbol('FeedbackAnalyzer'),
  MONITORING_MANAGER: Symbol('MonitoringManager'),
  BROWSER_MANAGER: Symbol('BrowserManager'),
  IMAGE_PROCESSOR: Symbol('ImageProcessor'),
  FILE_MANAGER: Symbol('FileManager'),
  METRICS_COLLECTOR: Symbol('MetricsCollector'),
  HEALTH_CHECKER: Symbol('HealthChecker'),
  CLEANUP_MANAGER: Symbol('CleanupManager'),
  PLUGIN_MANAGER: Symbol('PluginManager'),
  CACHE: Symbol('Cache')
} as const;
