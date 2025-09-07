import path from 'path';
import { z } from 'zod';

/**
 * Configuration schema with validation
 */
const ConfigSchema = z.object({
  // Directory paths
  outputDir: z.string().default(path.join(process.cwd(), 'screenshots')),
  comparisonsDir: z.string().default(path.join(process.cwd(), 'comparisons')),
  tempDir: z.string().default(path.join(process.cwd(), 'temp')),
  
  // Screenshot settings
  screenshot: z.object({
    defaultFormat: z.enum(['png', 'jpeg']).default('png'),
    defaultQuality: z.number().int().min(1).max(100).default(90),
    defaultViewport: z.object({
      width: z.number().int().positive().default(1200),
      height: z.number().int().positive().default(800)
    }),
    timeout: z.number().int().positive().default(30000), // 30 seconds
    waitForNetworkIdle: z.boolean().default(true)
  }),
  
  // Comparison settings  
  comparison: z.object({
    defaultTolerance: z.number().min(0).max(100).default(5),
    defaultThreshold: z.number().min(0).max(1).default(0.1),
    minRegionSize: z.number().int().positive().default(10),
    maxDiffPercentage: z.number().min(0).max(100).default(50)
  }),
  
  // Monitoring settings
  monitoring: z.object({
    defaultInterval: z.number().int().min(1).max(300).default(5),
    maxSessions: z.number().int().positive().default(10),
    significantChangeThreshold: z.number().min(0).max(100).default(2),
    maxScreenshotsPerSession: z.number().int().positive().default(1000)
  }),
  
  // Browser settings
  browser: z.object({
    headless: z.boolean().default(true),
    timeout: z.number().int().positive().default(30000),
    args: z.array(z.string()).default([
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ])
  }),
  
  // Logging settings
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableFileLogging: z.boolean().default(false),
    logFile: z.string().default(path.join(process.cwd(), 'logs', 'visual-mcp.log'))
  })
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration manager with validation and environment variable support
 */
export class ConfigManager {
  private static instance: ConfigManager;
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
        defaultQuality: process.env.VISUAL_MCP_SCREENSHOT_QUALITY ? parseInt(process.env.VISUAL_MCP_SCREENSHOT_QUALITY) : undefined,
        timeout: process.env.VISUAL_MCP_SCREENSHOT_TIMEOUT ? parseInt(process.env.VISUAL_MCP_SCREENSHOT_TIMEOUT) : undefined,
        waitForNetworkIdle: process.env.VISUAL_MCP_WAIT_NETWORK_IDLE === 'true'
      },
      
      comparison: {
        defaultTolerance: process.env.VISUAL_MCP_TOLERANCE ? parseFloat(process.env.VISUAL_MCP_TOLERANCE) : undefined,
        defaultThreshold: process.env.VISUAL_MCP_THRESHOLD ? parseFloat(process.env.VISUAL_MCP_THRESHOLD) : undefined
      },
      
      monitoring: {
        defaultInterval: process.env.VISUAL_MCP_MONITOR_INTERVAL ? parseInt(process.env.VISUAL_MCP_MONITOR_INTERVAL) : undefined,
        maxSessions: process.env.VISUAL_MCP_MAX_SESSIONS ? parseInt(process.env.VISUAL_MCP_MAX_SESSIONS) : undefined
      },
      
      browser: {
        headless: process.env.VISUAL_MCP_HEADLESS !== 'false',
        timeout: process.env.VISUAL_MCP_BROWSER_TIMEOUT ? parseInt(process.env.VISUAL_MCP_BROWSER_TIMEOUT) : undefined
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
      return ConfigSchema.parse(cleanConfig);
    } catch (error) {
      throw new Error(`Invalid configuration: ${error}`);
    }
  }

  private removeUndefined(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [
          key,
          value && typeof value === 'object' && !Array.isArray(value)
            ? this.removeUndefined(value)
            : value
        ])
    );
  }

  public getConfig(): Config {
    return this.config;
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = ConfigSchema.parse({ ...this.config, ...updates });
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
}

// Export singleton instance
export const config = ConfigManager.getInstance();