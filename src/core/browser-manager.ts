import { EventEmitter } from 'events';

import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';

import { IBrowserManager, ICleanupManager } from '../interfaces/index.js';

import { config } from './config.js';
import { BrowserLaunchError } from './errors.js';
import { createLogger } from './logger.js';

const logger = createLogger('BrowserManager');

/**
 * Manages browser instances with proper lifecycle management
 */
export class BrowserManager extends EventEmitter implements IBrowserManager {
  private browser: Browser | null = null;
  private pages = new Set<Page>();
  private isInitializing = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    // Start health check
    this.startHealthCheck();

    logger.debug('BrowserManager initialized');
  }

  // Register cleanup handler method (called externally)
  registerCleanup(cleanupManager: ICleanupManager): void {
    cleanupManager.registerCleanupHandler('BrowserManager', () => this.cleanup());
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
    if (!this.browser || (this.browser.process() && this.browser.process()!.killed)) {
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
      if (this.browser) {
        await this.browser.version();
        return this.browser;
      }
      throw new BrowserLaunchError();
    } catch (error) {
      logger.warn('Browser unresponsive, restarting', { error: (error as Error).message });
      await this.restartBrowser();
      if (this.browser) {
        return this.browser;
      }
      throw new BrowserLaunchError();
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.isInitializing = true;

    try {
      logger.info('Launching browser');

      const launchOptions: PuppeteerLaunchOptions = {
        headless: config.browserConfig.headless,
        args: config.browserConfig.args,
        timeout: config.browserConfig.timeout,
        // Disable sandbox in containerized environments
        ...(process.env.DOCKER_CONTAINER && {
          args: [...config.browserConfig.args, '--no-sandbox']
        })
      };

      this.browser = await puppeteer.launch(launchOptions);

      // Set up browser-level error handling
      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected');
        this.browser = null;
        this.pages.clear();
        this.emit('browser_disconnected');
      });

      logger.info('Browser launched successfully', {
        version: await this.browser.version(),
        pages: (await this.browser.pages()).length
      });

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
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      logger.warn('Error closing browser during restart', { error: (error as Error).message });
    }

    this.browser = null;
    this.pages.clear();

    // Don't wait for initialization, let it happen on next getBrowser() call
    this.emit('browser_restarted');
  }

  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Track the page
    this.pages.add(page);

    // Set up page-level error handling
    page.on('error', error => {
      logger.warn('Page error', { error: error.message });
      this.pages.delete(page);
    });

    page.on('close', () => {
      logger.debug('Page closed');
      this.pages.delete(page);
    });

    // Set default viewport from config if not set
    await page.setViewport(config.screenshotDefaults.defaultViewport);

    logger.debug('Page created', { totalPages: this.pages.size });

    return page;
  }

  async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      logger.warn('Error closing page', { error: (error as Error).message });
      this.pages.delete(page); // Remove from tracking anyway
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.browser || (this.browser.process() && this.browser.process()!.killed)) {
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

  getActivePageCount(): number {
    return this.pages.size;
  }

  async getAllPages(): Promise<Page[]> {
    if (!this.browser) return [];

    try {
      return await this.browser.pages();
    } catch (error) {
      logger.warn('Error getting pages', { error: (error as Error).message });
      return [];
    }
  }

  async closeAllPages(): Promise<void> {
    const pages = Array.from(this.pages);

    await Promise.allSettled(
      pages.map(async page => {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (error) {
          logger.warn('Error closing page during cleanup', { error: (error as Error).message });
        }
      })
    );

    this.pages.clear();
  }

  async cleanup(): Promise<void> {
    logger.info('Starting browser cleanup');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close all pages first
    await this.closeAllPages();

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
        logger.debug('Browser closed successfully');
      } catch (error) {
        logger.warn('Error closing browser', { error: (error as Error).message });
      } finally {
        this.browser = null;
      }
    }

    // Remove all listeners
    this.removeAllListeners();

    logger.info('Browser cleanup completed');
  }
}

// Export singleton instance
export const browserManager = new BrowserManager();
