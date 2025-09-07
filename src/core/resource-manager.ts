import { EventEmitter } from 'events';
import { ICleanupManager, IBrowserManager } from '../interfaces/index.js';
import { BrowserLaunchError, BrowserConnectionError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { config } from '../core/config.js';
import puppeteer, { Browser, Page } from 'puppeteer';

const logger = createLogger('ResourceManager');

/**
 * Manages cleanup operations across the application
 */
export class CleanupManager extends EventEmitter implements ICleanupManager {
  private cleanupHandlers = new Map<string, () => Promise<void>>();
  private isShuttingDown = false;

  constructor() {
    super();
    this.setupProcessHandlers();
    logger.debug('CleanupManager initialized');
  }

  private setupProcessHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      logger.info('Shutdown signal received', { signal });
      this.isShuttingDown = true;
      
      try {
        await this.cleanup();
        logger.info('Cleanup completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during cleanup', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception, shutting down', error);
      await shutdown('uncaughtException');
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled promise rejection, shutting down', new Error(String(reason)), { promise });
      await shutdown('unhandledRejection');
    });
  }

  registerCleanupHandler(name: string, handler: () => Promise<void>): void {
    logger.debug('Registering cleanup handler', { name });
    this.cleanupHandlers.set(name, handler);
    this.emit('handler_registered', { name });
  }

  removeCleanupHandler(name: string): void {
    if (this.cleanupHandlers.delete(name)) {
      logger.debug('Cleanup handler removed', { name });
      this.emit('handler_removed', { name });
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleanupHandlers.size === 0) {
      logger.debug('No cleanup handlers to execute');
      return;
    }

    logger.info('Starting cleanup', { handlersCount: this.cleanupHandlers.size });
    this.emit('cleanup_started');

    const results = await Promise.allSettled(
      Array.from(this.cleanupHandlers.entries()).map(async ([name, handler]) => {
        try {
          logger.debug('Executing cleanup handler', { name });
          await handler();
          logger.debug('Cleanup handler completed', { name });
        } catch (error) {
          logger.error('Cleanup handler failed', error as Error, { name });
          throw error;
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some cleanup handlers failed', { 
        failures: failures.length,
        total: results.length
      });
    }

    this.emit('cleanup_completed', { 
      total: results.length,
      failures: failures.length
    });
    
    logger.info('Cleanup completed', { 
      total: results.length,
      failures: failures.length
    });
  }
}

/**
 * Manages browser instances with proper lifecycle management
 */
export class BrowserManager extends EventEmitter implements IBrowserManager {
  private browser: Browser | null = null;
  private pages = new Set<Page>();
  private isInitializing = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private cleanupManager: CleanupManager) {
    super();
    
    // Register cleanup handler
    cleanupManager.registerCleanupHandler('BrowserManager', () => this.cleanup());
    
    // Start health check
    this.startHealthCheck();
    
    logger.debug('BrowserManager initialized');
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthy = await this.isHealthy();
        if (!healthy) {
          logger.warn('Browser health check failed, will restart on next use');
          await this.restartBrowser();
        }
      } catch (error) {
        logger.warn('Health check error', { error: (error as Error).message });
      }
    }, 30000); // Check every 30 seconds
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browser || this.browser.process()?.killed) {
      if (this.isInitializing) {
        // Wait for ongoing initialization
        await new Promise(resolve => this.once('browser_ready', resolve));
        if (!this.browser) {
          throw new BrowserLaunchError();
        }
        return this.browser;
      }

      await this.initializeBrowser();
    }

    try {
      // Test if browser is still responsive
      await this.browser.version();
      return this.browser;
    } catch (error) {
      logger.warn('Browser unresponsive, restarting', { error: (error as Error).message });
      await this.restartBrowser();
      return this.browser!;
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.isInitializing = true;
    
    try {
      logger.info('Launching browser');
      
      const browserConfig = config.browserConfig;
      this.browser = await puppeteer.launch({
        headless: browserConfig.headless,
        args: browserConfig.args,
        timeout: browserConfig.timeout
      });

      // Set up browser event handlers
      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected');
        this.browser = null;
        this.emit('browser_disconnected');
      });

      logger.info('Browser launched successfully');
      this.emit('browser_ready');
    } catch (error) {
      logger.error('Failed to launch browser', error as Error);
      throw new BrowserLaunchError(error as Error);
    } finally {
      this.isInitializing = false;
    }
  }

  private async restartBrowser(): Promise<void> {
    logger.info('Restarting browser');
    
    try {
      // Close existing browser
      if (this.browser) {
        await this.closeBrowser();
      }
      
      // Initialize new browser
      await this.initializeBrowser();
      
      logger.info('Browser restarted successfully');
    } catch (error) {
      logger.error('Failed to restart browser', error as Error);
      throw error;
    }
  }

  async createPage(): Promise<Page> {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      // Track the page
      this.pages.add(page);
      
      // Set up page defaults
      await page.setDefaultNavigationTimeout(config.screenshotDefaults.timeout);
      await page.setDefaultTimeout(config.screenshotDefaults.timeout);
      
      // Handle page events
      page.on('close', () => {
        this.pages.delete(page);
        logger.debug('Page closed', { activePagesCount: this.pages.size });
      });

      page.on('error', (error) => {
        logger.warn('Page error', { error: error.message });
      });

      logger.debug('Page created', { activePagesCount: this.pages.size });
      this.emit('page_created', { pagesCount: this.pages.size });
      
      return page;
    } catch (error) {
      logger.error('Failed to create page', error as Error);
      throw new BrowserConnectionError(error as Error);
    }
  }

  async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
      this.pages.delete(page);
      
      logger.debug('Page closed manually', { activePagesCount: this.pages.size });
    } catch (error) {
      logger.warn('Error closing page', { error: (error as Error).message });
      this.pages.delete(page); // Remove from tracking anyway
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.browser || this.browser.process()?.killed) {
        return false;
      }

      // Try to get browser version as a health check
      await this.browser.version();
      return true;
    } catch (error) {
      logger.debug('Browser health check failed', { error: (error as Error).message });
      return false;
    }
  }

  private async closeBrowser(): Promise<void> {
    if (!this.browser) return;

    try {
      logger.debug('Closing browser', { activePagesCount: this.pages.size });
      
      // Close all pages first
      const pageClosePromises = Array.from(this.pages).map(async (page) => {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (error) {
          logger.debug('Error closing page during browser shutdown', { error: (error as Error).message });
        }
      });

      await Promise.allSettled(pageClosePromises);
      this.pages.clear();

      // Close browser
      await this.browser.close();
      this.browser = null;
      
      logger.debug('Browser closed successfully');
    } catch (error) {
      logger.warn('Error closing browser', { error: (error as Error).message });
      this.browser = null; // Reset anyway
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Starting browser cleanup');
    
    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close browser
    await this.closeBrowser();
    
    // Remove all listeners
    this.removeAllListeners();
    
    logger.info('Browser cleanup completed');
  }
}

/**
 * Resource pool for managing reusable resources
 */
export class ResourcePool<T> extends EventEmitter {
  private available: T[] = [];
  private inUse = new Set<T>();
  private maxSize: number;
  private createResource: () => Promise<T>;
  private destroyResource: (resource: T) => Promise<void>;

  constructor(
    maxSize: number,
    createResource: () => Promise<T>,
    destroyResource: (resource: T) => Promise<void>
  ) {
    super();
    this.maxSize = maxSize;
    this.createResource = createResource;
    this.destroyResource = destroyResource;
    
    logger.debug('ResourcePool created', { maxSize });
  }

  async acquire(): Promise<T> {
    // Try to get available resource
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      this.inUse.add(resource);
      logger.debug('Resource acquired from pool', { 
        availableCount: this.available.length,
        inUseCount: this.inUse.size
      });
      return resource;
    }

    // Create new resource if under limit
    if (this.inUse.size < this.maxSize) {
      try {
        const resource = await this.createResource();
        this.inUse.add(resource);
        logger.debug('New resource created', { 
          availableCount: this.available.length,
          inUseCount: this.inUse.size
        });
        this.emit('resource_created', { resource });
        return resource;
      } catch (error) {
        logger.error('Failed to create resource', error as Error);
        throw error;
      }
    }

    // Wait for resource to become available
    return new Promise<T>((resolve) => {
      this.once('resource_released', () => {
        this.acquire().then(resolve).catch(() => {
          // Retry on error
          setTimeout(() => this.acquire().then(resolve), 100);
        });
      });
    });
  }

  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      logger.warn('Attempting to release resource not in use');
      return;
    }

    this.inUse.delete(resource);
    this.available.push(resource);
    
    logger.debug('Resource released', { 
      availableCount: this.available.length,
      inUseCount: this.inUse.size
    });
    
    this.emit('resource_released', { resource });
  }

  async destroy(): Promise<void> {
    logger.info('Destroying resource pool', {
      availableCount: this.available.length,
      inUseCount: this.inUse.size
    });

    // Destroy all resources
    const allResources = [...this.available, ...this.inUse];
    const destroyPromises = allResources.map(async (resource) => {
      try {
        await this.destroyResource(resource);
      } catch (error) {
        logger.warn('Error destroying resource', { error: (error as Error).message });
      }
    });

    await Promise.allSettled(destroyPromises);
    
    this.available.length = 0;
    this.inUse.clear();
    this.removeAllListeners();
    
    logger.info('Resource pool destroyed');
  }

  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }
}

// Export singleton instances
export const cleanupManager = new CleanupManager();
export const browserManager = new BrowserManager(cleanupManager);