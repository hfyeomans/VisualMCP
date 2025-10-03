import { Page } from 'puppeteer';
import { createLogger } from '../core/logger.js';
import { ScreenshotTimeoutError, ScreenshotNavigationError } from '../core/errors.js';

const logger = createLogger('BrowserSession');

export interface BrowserSessionOptions {
  viewport?: { width: number; height: number };
  timeout: number;
  waitForNetworkIdle: boolean;
}

/**
 * Manages browser page lifecycle and setup
 * Extracted from ScreenshotEngine to promote reusability and testability
 */
export class BrowserSession {
  /**
   * Setup and navigate a page to a URL with proper lifecycle management
   */
  async setupPage(page: Page, url: string, options: BrowserSessionOptions): Promise<void> {
    // Set viewport if specified
    if (options.viewport) {
      await page.setViewport({
        width: options.viewport.width,
        height: options.viewport.height,
        deviceScaleFactor: 1
      });

      logger.debug('Viewport set', options.viewport);
    }

    // Navigate to URL with timeout handling
    try {
      await page.goto(url, {
        waitUntil: options.waitForNetworkIdle ? 'networkidle0' : 'load',
        timeout: options.timeout
      });
    } catch (error) {
      if ((error as Error).message.includes('timeout')) {
        throw new ScreenshotTimeoutError(url, options.timeout, error as Error);
      }
      throw new ScreenshotNavigationError(url, error as Error);
    }

    logger.debug('Page loaded, waiting for stability');

    // Wait for any animations or dynamic content to complete
    await this.waitForPageStability(page);
  }

  /**
   * Wait for page to be stable (no pending animations/transitions)
   */
  private async waitForPageStability(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise<void>(resolve => {
        /* eslint-disable no-undef */
        if (document.readyState === 'complete') {
          setTimeout(resolve, 500);
        } else {
          window.addEventListener('load', () => setTimeout(resolve, 500));
        }
        /* eslint-enable no-undef */
      });
    });
  }
}
