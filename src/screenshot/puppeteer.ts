import path from 'path';
import { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { IScreenshotEngine, IBrowserManager } from '../interfaces/index.js';
import { ScreenshotTarget, ScreenshotOptions, ScreenshotResult } from '../types/index.js';
import {
  ScreenshotError,
  ScreenshotTimeoutError,
  ScreenshotNavigationError,
  ScreenshotCaptureError
} from '../core/errors.js';
import { config } from '../core/config.js';
import { createLogger } from '../core/logger.js';
import { fileManager } from '../utils/file-utils.js';
import { imageProcessor } from '../utils/image-utils.js';

const logger = createLogger('ScreenshotEngine');

export class ScreenshotEngine implements IScreenshotEngine {
  private outputDir: string;

  constructor(private browserManager: IBrowserManager) {
    this.outputDir = config.outputDir;
    this.ensureOutputDirectory();

    logger.debug('ScreenshotEngine initialized', { outputDir: this.outputDir });
  }

  private async ensureOutputDirectory(): Promise<void> {
    await fileManager.ensureDirectory(this.outputDir);
  }

  async takeScreenshot(
    target: ScreenshotTarget,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Apply defaults from config
    const mergedOptions = {
      ...config.screenshotDefaults,
      ...options
    };

    const filename = mergedOptions.filename || `screenshot_${uuidv4()}.${mergedOptions.format}`;
    const filepath = path.join(this.outputDir, filename);

    logger.info('Taking screenshot', {
      targetType: target.type,
      format: mergedOptions.format,
      filename
    });

    try {
      switch (target.type) {
        case 'url':
          return await this.takeWebScreenshot(target, mergedOptions, filepath, timestamp);

        case 'region':
          return await this.takeRegionScreenshot(target, mergedOptions, filepath, timestamp);

        default:
          throw new ScreenshotError(
            `Unsupported target type: ${(target as any).type}`,
            'UNSUPPORTED_TARGET_TYPE'
          );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Screenshot failed', error as Error, {
        targetType: target.type,
        duration,
        filename
      });

      if (error instanceof ScreenshotError) {
        throw error;
      }

      throw new ScreenshotCaptureError((error as Error).message, error as Error);
    }
  }

  private async takeWebScreenshot(
    target: ScreenshotTarget & { type: 'url' },
    options: {
      defaultFormat: 'png' | 'jpeg';
      defaultQuality: number;
      defaultViewport: { width: number; height: number };
      timeout: number;
      waitForNetworkIdle: boolean;
      format?: 'png' | 'jpeg';
      quality?: number;
      fullPage?: boolean;
      filename?: string;
      clip?: any;
    },
    filepath: string,
    timestamp: string
  ): Promise<ScreenshotResult> {
    let page: Page | null = null;

    try {
      page = await this.browserManager.createPage();

      logger.debug('Navigating to URL', { url: target.url });

      // Set viewport if specified
      if (target.viewport) {
        if (page) {
          await page.setViewport({
            width: target.viewport.width,
            height: target.viewport.height,
            deviceScaleFactor: 1
          });
        }

        logger.debug('Viewport set', target.viewport);
      }

      // Navigate to URL with timeout handling
      try {
        if (page) {
          await page.goto(target.url, {
            waitUntil: options.waitForNetworkIdle ? 'networkidle0' : 'load',
            timeout: options.timeout
          });
        }
      } catch (error) {
        if ((error as Error).message.includes('timeout')) {
          throw new ScreenshotTimeoutError(target.url, options.timeout, error as Error);
        }
        throw new ScreenshotNavigationError(target.url, error as Error);
      }

      logger.debug('Page loaded, waiting for stability');

      // Wait for any animations or dynamic content to complete
      if (page) {
        await page.evaluate(() => {
          return new Promise<void>(resolve => {
            if (document.readyState === 'complete') {
              setTimeout(resolve, 500);
            } else {
              window.addEventListener('load', () => setTimeout(resolve, 500));
            }
          });
        });
      }

      // Take screenshot
      const screenshotOptions: any = {
        path: filepath,
        type: options.format || options.defaultFormat,
        fullPage: options.fullPage
      };

      if ((options.format || options.defaultFormat) === 'jpeg') {
        screenshotOptions.quality = options.quality || options.defaultQuality;
      }

      if (options.clip) {
        screenshotOptions.clip = options.clip;
      }

      logger.debug('Capturing screenshot', {
        fullPage: options.fullPage,
        hasClip: !!options.clip
      });

      if (page) {
        await page.screenshot(screenshotOptions);
      }

      // Get image metadata
      const metadata = await imageProcessor.getImageMetadata(filepath);

      logger.info('Web screenshot completed successfully', {
        filepath,
        size: metadata.size,
        dimensions: `${metadata.width}x${metadata.height}`,
        url: target.url
      });

      return {
        filepath,
        width: metadata.width,
        height: metadata.height,
        format: options.format || 'png',
        size: metadata.size,
        timestamp,
        target
      };
    } finally {
      if (page) {
        await this.browserManager.closePage(page);
      }
    }
  }

  private async takeRegionScreenshot(
    target: ScreenshotTarget & { type: 'region' },
    options: {
      defaultFormat: 'png' | 'jpeg';
      defaultQuality: number;
      defaultViewport: { width: number; height: number };
      timeout: number;
      waitForNetworkIdle: boolean;
      format?: 'png' | 'jpeg';
      quality?: number;
      fullPage?: boolean;
      filename?: string;
      clip?: any;
    },
    filepath: string,
    timestamp: string
  ): Promise<ScreenshotResult> {
    logger.warn('Desktop region capture not fully implemented, creating placeholder');

    // This is a placeholder implementation - in production, you'd use platform-specific
    // screen capture APIs or tools like screenshot-desktop
    const placeholderHtml = `
      <html>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f0f0f0;">
          <div style="border: 2px dashed #999; padding: 30px; text-align: center; background: white;">
            <h2 style="color: #666;">Region Screenshot Placeholder</h2>
            <p><strong>Target Region:</strong> (${target.x}, ${target.y}) ${target.width}×${target.height}</p>
            <p style="color: #666; font-size: 14px;">
              Desktop region capture requires platform-specific implementation.
              <br>This placeholder represents the requested region.
            </p>
            <div style="margin-top: 20px; padding: 10px; background: #e8f4f8; border: 1px solid #b8e0f0; border-radius: 4px;">
              <small>Timestamp: ${timestamp}</small>
            </div>
          </div>
        </body>
      </html>
    `;

    let page: Page | null = null;

    try {
      page = await this.browserManager.createPage();

      if (page) {
        await page.setContent(placeholderHtml);
        await page.setViewport({
          width: Math.max(target.width, 400),
          height: Math.max(target.height, 300)
        });
      }

      const screenshotOptions: any = {
        path: filepath,
        type: options.format || options.defaultFormat,
        clip: {
          x: 0,
          y: 0,
          width: Math.max(target.width, 400),
          height: Math.max(target.height, 300)
        }
      };

      if ((options.format || options.defaultFormat) === 'jpeg') {
        screenshotOptions.quality = options.quality || options.defaultQuality;
      }

      if (page) {
        await page.screenshot(screenshotOptions);
      }

      const metadata = await imageProcessor.getImageMetadata(filepath);

      logger.info('Region screenshot placeholder created', {
        filepath,
        region: `${target.x},${target.y} ${target.width}×${target.height}`,
        size: metadata.size
      });

      return {
        filepath,
        width: metadata.width,
        height: metadata.height,
        format: options.format || 'png',
        size: metadata.size,
        timestamp,
        target
      };
    } finally {
      if (page) {
        await this.browserManager.closePage(page);
      }
    }
  }

  async listScreenshots(): Promise<string[]> {
    try {
      logger.debug('Listing screenshots', { directory: this.outputDir });

      const screenshots = await fileManager.listFiles(this.outputDir);
      const imageFiles = screenshots.filter(file => file.match(/\.(png|jpeg|jpg)$/i));

      logger.debug('Screenshots listed', { count: imageFiles.length });
      return imageFiles;
    } catch (error) {
      logger.error('Error listing screenshots', error as Error, {
        directory: this.outputDir
      });
      return [];
    }
  }

  async deleteScreenshot(filepath: string): Promise<boolean> {
    try {
      logger.debug('Deleting screenshot', { filepath });
      await fileManager.deleteFile(filepath);
      logger.info('Screenshot deleted', { filepath });
      return true;
    } catch (error) {
      logger.error('Failed to delete screenshot', error as Error, { filepath });
      return false;
    }
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }

  setOutputDirectory(dir: string): void {
    logger.info('Changing output directory', {
      from: this.outputDir,
      to: dir
    });

    this.outputDir = dir;
    this.ensureOutputDirectory();
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up ScreenshotEngine');
    // Cleanup is handled by BrowserManager
    // Any additional cleanup specific to ScreenshotEngine would go here
  }
}
