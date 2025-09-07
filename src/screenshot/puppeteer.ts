import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ScreenshotTarget, ScreenshotOptions, ScreenshotResult } from '../types/index.js';

export class ScreenshotEngine {
  private browser: Browser | null = null;
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'screenshots');
    this.ensureOutputDirectory();
  }

  private async ensureOutputDirectory() {
    await fs.ensureDir(this.outputDir);
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
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
    }
    return this.browser;
  }

  async takeScreenshot(
    target: ScreenshotTarget,
    options: ScreenshotOptions = { format: 'png', fullPage: false }
  ): Promise<ScreenshotResult> {
    const timestamp = new Date().toISOString();
    const filename = options.filename || `screenshot_${uuidv4()}.${options.format || 'png'}`;
    const filepath = path.join(this.outputDir, filename);

    switch (target.type) {
      case 'url':
        return await this.takeWebScreenshot(target, options, filepath, timestamp);
      
      case 'region':
        return await this.takeRegionScreenshot(target, options, filepath, timestamp);
      
      default:
        throw new Error(`Unsupported target type: ${(target as any).type}`);
    }
  }

  private async takeWebScreenshot(
    target: ScreenshotTarget & { type: 'url' },
    options: ScreenshotOptions,
    filepath: string,
    timestamp: string
  ): Promise<ScreenshotResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport if specified
      if (target.viewport) {
        await page.setViewport({
          width: target.viewport.width,
          height: target.viewport.height,
          deviceScaleFactor: 1
        });
      }

      // Navigate to URL
      await page.goto(target.url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for any animations to complete
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if (document.readyState === 'complete') {
            setTimeout(resolve, 500);
          } else {
            window.addEventListener('load', () => setTimeout(resolve, 500));
          }
        });
      });

      // Take screenshot
      const screenshotOptions: any = {
        path: filepath,
        type: options.format || 'png',
        fullPage: options.fullPage || false
      };

      if (options.format === 'jpeg' && options.quality) {
        screenshotOptions.quality = options.quality;
      }

      if (options.clip) {
        screenshotOptions.clip = options.clip;
      }

      await page.screenshot(screenshotOptions);

      // Get image dimensions
      const stats = await fs.stat(filepath);
      const dimensions = await this.getImageDimensions(filepath);

      return {
        filepath,
        width: dimensions.width,
        height: dimensions.height,
        format: options.format || 'png',
        size: stats.size,
        timestamp,
        target
      };

    } finally {
      await page.close();
    }
  }

  private async takeRegionScreenshot(
    target: ScreenshotTarget & { type: 'region' },
    options: ScreenshotOptions,
    filepath: string,
    timestamp: string
  ): Promise<ScreenshotResult> {
    // For region screenshots, we'll use a system-level screenshot tool
    // This implementation will depend on the platform
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Create a simple HTML page that we can screenshot
      // This is a workaround since puppeteer can't directly capture desktop regions
      const html = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif;">
            <div style="border: 2px dashed #ccc; padding: 20px; text-align: center;">
              <h2>Region Screenshot Placeholder</h2>
              <p>Target Region: ${target.x}, ${target.y} (${target.width}x${target.height})</p>
              <p style="color: #666; font-size: 14px;">
                Note: Desktop region capture requires platform-specific implementation.
                <br>This is a placeholder for region (${target.x}, ${target.y}, ${target.width}, ${target.height})
              </p>
            </div>
          </body>
        </html>
      `;

      await page.setContent(html);
      await page.setViewport({
        width: Math.max(target.width, 400),
        height: Math.max(target.height, 300)
      });

      const screenshotOptions: any = {
        path: filepath,
        type: options.format || 'png',
        clip: {
          x: 0,
          y: 0,
          width: Math.max(target.width, 400),
          height: Math.max(target.height, 300)
        }
      };

      if (options.format === 'jpeg' && options.quality) {
        screenshotOptions.quality = options.quality;
      }

      await page.screenshot(screenshotOptions);

      const stats = await fs.stat(filepath);
      const dimensions = await this.getImageDimensions(filepath);

      return {
        filepath,
        width: dimensions.width,
        height: dimensions.height,
        format: options.format || 'png',
        size: stats.size,
        timestamp,
        target
      };

    } finally {
      await page.close();
    }
  }

  private async getImageDimensions(filepath: string): Promise<{ width: number; height: number }> {
    try {
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(filepath).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0
      };
    } catch (error) {
      console.error('Error getting image dimensions:', error);
      return { width: 0, height: 0 };
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async listScreenshots(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.outputDir);
      return files
        .filter(file => file.match(/\.(png|jpeg|jpg)$/i))
        .map(file => path.join(this.outputDir, file));
    } catch (error) {
      console.error('Error listing screenshots:', error);
      return [];
    }
  }

  async deleteScreenshot(filepath: string): Promise<boolean> {
    try {
      await fs.remove(filepath);
      return true;
    } catch (error) {
      console.error('Error deleting screenshot:', error);
      return false;
    }
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }

  setOutputDirectory(dir: string): void {
    this.outputDir = dir;
    this.ensureOutputDirectory();
  }
}