import path from 'path';

import { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../core/config.js';
import { ScreenshotError, ScreenshotCaptureError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import {
  IScreenshotEngine,
  IBrowserManager,
  IFileManager,
  IImageProcessor
} from '../interfaces/index.js';
import { ScreenshotTarget, ScreenshotOptions, ScreenshotResult } from '../types/index.js';
import { fileManager } from '../utils/file-utils.js';
import { imageProcessor } from '../utils/image-utils.js';
import { sanitizeFilename } from '../utils/sanitization.js';

import { BrowserSession } from './browser-session.js';

const logger = createLogger('ScreenshotEngine');

export class ScreenshotEngine implements IScreenshotEngine {
  private outputDir: string;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private browserSession: BrowserSession;

  constructor(
    private browserManager: IBrowserManager,
    private readonly fileHelper: IFileManager = fileManager,
    private readonly imageHelper: IImageProcessor = imageProcessor
  ) {
    this.outputDir = config.outputDir;
    this.browserSession = new BrowserSession();
    logger.debug('ScreenshotEngine initialized', { outputDir: this.outputDir });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.fileHelper.ensureDirectory(this.outputDir);
        this.initialized = true;
      })().finally(() => {
        this.initPromise = null;
      });
    }

    await this.initPromise;
  }

  async init(): Promise<void> {
    await this.ensureInitialized();
  }

  async takeScreenshot(
    target: ScreenshotTarget,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    await this.ensureInitialized();

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Apply defaults from config
    const mergedOptions = {
      ...config.screenshotDefaults,
      ...options
    };

    // Generate and sanitize filename
    const rawFilename = mergedOptions.filename || `screenshot_${uuidv4()}.${mergedOptions.format}`;
    const filename = sanitizeFilename(rawFilename, {
      allowedExtensions: ['png', 'jpeg', 'jpg'],
      defaultExtension: mergedOptions.format
    });
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
            `Unsupported target type: ${(target as unknown as { type: string }).type}`,
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
      clip?: { x: number; y: number; width: number; height: number };
    },
    filepath: string,
    timestamp: string
  ): Promise<ScreenshotResult> {
    let page: Page | null = null;

    try {
      page = (await this.browserManager.createPage()) as Page;

      logger.debug('Navigating to URL', { url: target.url });

      // Use BrowserSession to handle page lifecycle
      await this.browserSession.setupPage(page, target.url, {
        viewport: target.viewport,
        timeout: options.timeout,
        waitForNetworkIdle: options.waitForNetworkIdle
      });

      // Take screenshot
      const screenshotOptions: {
        path: string;
        type?: 'png' | 'jpeg';
        fullPage?: boolean;
        quality?: number;
        clip?: { x: number; y: number; width: number; height: number };
      } = {
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
      const metadata = await this.imageHelper.getImageMetadata(filepath);

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
    _options: {
      defaultFormat: 'png' | 'jpeg';
      defaultQuality: number;
      defaultViewport: { width: number; height: number };
      timeout: number;
      waitForNetworkIdle: boolean;
      format?: 'png' | 'jpeg';
      quality?: number;
      fullPage?: boolean;
      filename?: string;
      clip?: { x: number; y: number; width: number; height: number };
    },
    _filepath: string,
    _timestamp: string
  ): Promise<ScreenshotResult> {
    logger.warn('Desktop region capture attempted but not yet implemented', {
      targetRegion: {
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height
      }
    });

    throw new ScreenshotError(
      'Desktop region capture is not yet implemented. This feature requires native macOS ScreenCaptureKit support, which is currently under development. ' +
        'Please use URL-based screenshots (target.type = "url") for web content capture. ' +
        'Native desktop capture (windows, regions, displays) will be available in a future release with interactive content selection via ScreenCaptureKit on macOS 12.3+.',
      'REGION_CAPTURE_NOT_IMPLEMENTED'
    );
  }

  async listScreenshots(): Promise<string[]> {
    await this.ensureInitialized();

    try {
      logger.debug('Listing screenshots', { directory: this.outputDir });

      const screenshots = await this.fileHelper.listFiles(this.outputDir);
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
    await this.ensureInitialized();

    try {
      logger.debug('Deleting screenshot', { filepath });
      await this.fileHelper.deleteFile(filepath);
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
    this.initialized = false;
    this.initPromise = null;
    void this.ensureInitialized();
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up ScreenshotEngine');
    // Cleanup is handled by BrowserManager
    // Any additional cleanup specific to ScreenshotEngine would go here
  }
}
