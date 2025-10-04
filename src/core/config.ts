import path from 'path';
import { z } from 'zod';

const createDefaultScreenshotConfig = () => ({
  defaultFormat: 'png' as const,
  defaultQuality: 90,
  defaultViewport: {
    width: 1200,
    height: 800
  },
  timeout: 30000,
  waitForNetworkIdle: true
});

const createDefaultComparisonConfig = () => ({
  defaultTolerance: 5,
  defaultThreshold: 0.1,
  minRegionSize: 10,
  maxDiffPercentage: 50
});

const createDefaultMonitoringConfig = () => ({
  defaultInterval: 5,
  maxSessions: 10,
  significantChangeThreshold: 2,
  maxScreenshotsPerSession: 1000,
  persistSessions: true,
  sessionsDirectory: path.join(process.cwd(), 'comparisons'),
  autoFeedbackRateLimitMs: 60000,
  maxConcurrentFeedback: 2,
  schedulerJitterMs: 1000,
  schedulerBackoffMultiplier: 1.5,
  schedulerMaxBackoffMs: 60000
});

const createDefaultBrowserConfig = () => ({
  headless: true,
  timeout: 30000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
});

const createDefaultLoggingConfig = () => ({
  level: 'info' as const,
  enableFileLogging: false,
  logFile: path.join(process.cwd(), 'logs', 'visual-mcp.log')
});

const createDefaultAnalysisConfig = () => ({
  color: {
    lowContrastThreshold: 50,
    highRedPixelPercentage: 10,
    lowColorDiversityThreshold: 0.1,
    veryBrightThreshold: 240,
    veryDarkThreshold: 15
  },
  layout: {
    minRegionSize: 5,
    largeLayoutShiftPercentage: 10,
    mediumLayoutShiftPercentage: 2,
    highSeverityAreaThreshold: 5000,
    mediumSeverityAreaThreshold: 1000,
    edgeAlignmentThreshold: 30
  },
  enableMetadataPersistence: true,
  metadataDirectory: path.join(process.cwd(), 'comparisons', 'metadata')
});

const createDefaultConfig = () => ({
  outputDir: path.join(process.cwd(), 'screenshots'),
  comparisonsDir: path.join(process.cwd(), 'comparisons'),
  tempDir: path.join(process.cwd(), 'temp'),
  screenshot: createDefaultScreenshotConfig(),
  comparison: createDefaultComparisonConfig(),
  monitoring: createDefaultMonitoringConfig(),
  analysis: createDefaultAnalysisConfig(),
  browser: createDefaultBrowserConfig(),
  logging: createDefaultLoggingConfig()
});

/**
 * Configuration schema with validation
 */
const ConfigSchema = z.object({
  // Directory paths
  outputDir: z.string().default(() => path.join(process.cwd(), 'screenshots')),
  comparisonsDir: z.string().default(() => path.join(process.cwd(), 'comparisons')),
  tempDir: z.string().default(() => path.join(process.cwd(), 'temp')),

  // Screenshot settings
  screenshot: z
    .object({
      defaultFormat: z.enum(['png', 'jpeg']).default('png'),
      defaultQuality: z.number().int().min(1).max(100).default(90),
      defaultViewport: z.object({
        width: z.number().int().positive().default(1200),
        height: z.number().int().positive().default(800)
      }),
      timeout: z.number().int().positive().default(30000),
      waitForNetworkIdle: z.boolean().default(true)
    })
    .default(() => createDefaultScreenshotConfig()),

  // Comparison settings
  comparison: z
    .object({
      defaultTolerance: z.number().min(0).max(100).default(5),
      defaultThreshold: z.number().min(0).max(1).default(0.1),
      minRegionSize: z.number().int().positive().default(10),
      maxDiffPercentage: z.number().min(0).max(100).default(50)
    })
    .default(() => createDefaultComparisonConfig()),

  // Monitoring settings
  monitoring: z
    .object({
      defaultInterval: z.number().int().min(1).max(300).default(5),
      maxSessions: z.number().int().positive().default(10),
      significantChangeThreshold: z.number().min(0).max(100).default(2),
      maxScreenshotsPerSession: z.number().int().positive().default(1000),
      persistSessions: z.boolean().default(true),
      sessionsDirectory: z.string().default(() => path.join(process.cwd(), 'comparisons')),
      autoFeedbackRateLimitMs: z.number().int().positive().default(60000),
      maxConcurrentFeedback: z.number().int().positive().default(2),
      schedulerJitterMs: z.number().int().nonnegative().default(1000),
      schedulerBackoffMultiplier: z.number().min(1).default(1.5),
      schedulerMaxBackoffMs: z.number().int().positive().default(60000)
    })
    .default(() => createDefaultMonitoringConfig()),

  // Analysis settings
  analysis: z
    .object({
      // Color analysis thresholds
      color: z
        .object({
          lowContrastThreshold: z.number().min(0).max(255).default(50),
          highRedPixelPercentage: z.number().min(0).max(100).default(10),
          lowColorDiversityThreshold: z.number().min(0).max(1).default(0.1),
          veryBrightThreshold: z.number().min(0).max(255).default(240),
          veryDarkThreshold: z.number().min(0).max(255).default(15)
        })
        .default(() => ({
          lowContrastThreshold: 50,
          highRedPixelPercentage: 10,
          lowColorDiversityThreshold: 0.1,
          veryBrightThreshold: 240,
          veryDarkThreshold: 15
        })),
      // Layout analysis thresholds
      layout: z
        .object({
          minRegionSize: z.number().int().positive().default(5),
          largeLayoutShiftPercentage: z.number().min(0).max(100).default(10),
          mediumLayoutShiftPercentage: z.number().min(0).max(100).default(2),
          highSeverityAreaThreshold: z.number().int().positive().default(5000),
          mediumSeverityAreaThreshold: z.number().int().positive().default(1000),
          edgeAlignmentThreshold: z.number().int().positive().default(30)
        })
        .default(() => ({
          minRegionSize: 5,
          largeLayoutShiftPercentage: 10,
          mediumLayoutShiftPercentage: 2,
          highSeverityAreaThreshold: 5000,
          mediumSeverityAreaThreshold: 1000,
          edgeAlignmentThreshold: 30
        })),
      // General analysis settings
      enableMetadataPersistence: z.boolean().default(true),
      metadataDirectory: z
        .string()
        .default(() => path.join(process.cwd(), 'comparisons', 'metadata'))
    })
    .default(() => ({
      color: {
        lowContrastThreshold: 50,
        highRedPixelPercentage: 10,
        lowColorDiversityThreshold: 0.1,
        veryBrightThreshold: 240,
        veryDarkThreshold: 15
      },
      layout: {
        minRegionSize: 5,
        largeLayoutShiftPercentage: 10,
        mediumLayoutShiftPercentage: 2,
        highSeverityAreaThreshold: 5000,
        mediumSeverityAreaThreshold: 1000,
        edgeAlignmentThreshold: 30
      },
      enableMetadataPersistence: true,
      metadataDirectory: path.join(process.cwd(), 'comparisons', 'metadata')
    })),

  // Browser settings
  browser: z
    .object({
      headless: z.boolean().default(true),
      timeout: z.number().int().positive().default(30000),
      args: z
        .array(z.string())
        .default(() => [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ])
    })
    .default(() => createDefaultBrowserConfig()),

  // Logging settings
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      enableFileLogging: z.boolean().default(false),
      logFile: z.string().default(() => path.join(process.cwd(), 'logs', 'visual-mcp.log'))
    })
    .default(() => createDefaultLoggingConfig())
});

export type Config = z.infer<typeof ConfigSchema>;

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Configuration manager with validation and environment variable support
 */
export class ConfigManager {
  private static instance: ConfigManager | undefined;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): Config {
    // Load from environment variables with fallbacks
    const envConfig = {
      outputDir: process.env.VISUAL_MCP_OUTPUT_DIR,
      comparisonsDir: process.env.VISUAL_MCP_COMPARISONS_DIR,
      tempDir: process.env.VISUAL_MCP_TEMP_DIR,

      screenshot: {
        defaultFormat: process.env.VISUAL_MCP_SCREENSHOT_FORMAT as 'png' | 'jpeg',
        defaultQuality: process.env.VISUAL_MCP_SCREENSHOT_QUALITY
          ? parseInt(process.env.VISUAL_MCP_SCREENSHOT_QUALITY)
          : undefined,
        timeout: process.env.VISUAL_MCP_SCREENSHOT_TIMEOUT
          ? parseInt(process.env.VISUAL_MCP_SCREENSHOT_TIMEOUT)
          : undefined,
        waitForNetworkIdle:
          process.env.VISUAL_MCP_WAIT_NETWORK_IDLE !== undefined
            ? process.env.VISUAL_MCP_WAIT_NETWORK_IDLE === 'true'
            : undefined
      },

      comparison: {
        defaultTolerance: process.env.VISUAL_MCP_TOLERANCE
          ? parseFloat(process.env.VISUAL_MCP_TOLERANCE)
          : undefined,
        defaultThreshold: process.env.VISUAL_MCP_THRESHOLD
          ? parseFloat(process.env.VISUAL_MCP_THRESHOLD)
          : undefined
      },

      monitoring: {
        defaultInterval: process.env.VISUAL_MCP_MONITOR_INTERVAL
          ? parseInt(process.env.VISUAL_MCP_MONITOR_INTERVAL)
          : undefined,
        maxSessions: process.env.VISUAL_MCP_MAX_SESSIONS
          ? parseInt(process.env.VISUAL_MCP_MAX_SESSIONS)
          : undefined
      },

      browser: {
        headless: process.env.VISUAL_MCP_HEADLESS !== 'false',
        timeout: process.env.VISUAL_MCP_BROWSER_TIMEOUT
          ? parseInt(process.env.VISUAL_MCP_BROWSER_TIMEOUT)
          : undefined
      },

      logging: {
        level: process.env.VISUAL_MCP_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
        enableFileLogging: process.env.VISUAL_MCP_FILE_LOGGING === 'true',
        logFile: process.env.VISUAL_MCP_LOG_FILE
      }
    };

    // Remove undefined values
    const cleanConfig = this.removeUndefined(envConfig);

    // Validate and apply defaults
    try {
      const mergedConfig = deepMerge(
        createDefaultConfig(),
        cleanConfig as unknown as DeepPartial<Config>
      );
      return ConfigSchema.parse(mergedConfig);
    } catch (error) {
      throw new Error(`Invalid configuration: ${error}`);
    }
  }

  private removeUndefined(obj: unknown): unknown {
    if (!isPlainObject(obj)) {
      return obj;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (isPlainObject(value)) {
        const cleaned = this.removeUndefined(value);
        if (
          isPlainObject(cleaned) &&
          Object.keys(cleaned as Record<string, unknown>).length === 0
        ) {
          continue;
        }
        result[key] = cleaned;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  public getConfig(): Config {
    return this.config;
  }

  public updateConfig(updates: DeepPartial<Config>): void {
    const merged = deepMerge(this.config, updates);
    this.config = ConfigSchema.parse(merged);
  }

  // Convenience getters for commonly used values
  public get outputDir(): string {
    return this.config.outputDir;
  }

  public get comparisonsDir(): string {
    return this.config.comparisonsDir;
  }

  public get tempDir(): string {
    return this.config.tempDir;
  }

  public get screenshotDefaults() {
    return this.config.screenshot;
  }

  public get comparisonDefaults() {
    return this.config.comparison;
  }

  public get monitoringDefaults() {
    return this.config.monitoring;
  }

  public get browserConfig() {
    return this.config.browser;
  }

  public get loggingConfig() {
    return this.config.logging;
  }

  /**
   * Testing helper to reset singleton instance between suites.
   */
  public static resetForTesting(): void {
    ConfigManager.instance = undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const clone = <T>(value: T): T => {
  // Check if structuredClone is available (Node 17+)
  const structuredCloneFn = (globalThis as unknown as { structuredClone?: <U>(input: U) => U })
    .structuredClone;

  if (typeof structuredCloneFn === 'function') {
    return structuredCloneFn(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

function deepMerge<T extends Record<string, unknown>>(base: T, overrides: DeepPartial<T>): T {
  const result: Record<string, unknown> = clone(base);

  const mergeInto = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;

      if (isPlainObject(value)) {
        const existing = target[key];
        if (isPlainObject(existing)) {
          mergeInto(existing, value);
        } else {
          target[key] = clone(value);
        }
      } else {
        target[key] = value;
      }
    }
  };

  mergeInto(result, overrides);
  return result as T;
}

// Export singleton instance
export const config = ConfigManager.getInstance();
