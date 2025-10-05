import { ScreenshotError } from '../../core/errors.js';
import { IBrowserManager, IFileManager, IImageProcessor } from '../../interfaces/index.js';
import { ScreenshotEngine } from '../../screenshot/puppeteer.js';
import { ScreenshotTarget } from '../../types/index.js';

// Mock dependencies
const mockBrowserManager: IBrowserManager = {
  getBrowser: jest.fn(),
  createPage: jest.fn(),
  closePage: jest.fn(),
  cleanup: jest.fn(),
  isHealthy: jest.fn().mockResolvedValue(true)
};

const mockFileManager: IFileManager = {
  ensureDirectory: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn(),
  listFiles: jest.fn(),
  deleteFile: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  getFileStats: jest.fn()
};

const mockImageProcessor: IImageProcessor = {
  loadImage: jest.fn(),
  saveImage: jest.fn(),
  getImageMetadata: jest.fn(),
  resizeImage: jest.fn(),
  convertFormat: jest.fn(),
  prepareImagesForComparison: jest.fn()
};

describe('ScreenshotEngine', () => {
  let engine: ScreenshotEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ScreenshotEngine(mockBrowserManager, mockFileManager, mockImageProcessor);
  });

  describe('Region Capture', () => {
    it('should throw ScreenshotError when attempting desktop region capture', async () => {
      const target: ScreenshotTarget = {
        type: 'region',
        x: 100,
        y: 100,
        width: 800,
        height: 600
      };

      await expect(engine.takeScreenshot(target)).rejects.toThrow(ScreenshotError);
    });

    it('should throw error with REGION_CAPTURE_NOT_IMPLEMENTED code', async () => {
      const target: ScreenshotTarget = {
        type: 'region',
        x: 100,
        y: 100,
        width: 800,
        height: 600
      };

      try {
        await engine.takeScreenshot(target);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.code).toBe('REGION_CAPTURE_NOT_IMPLEMENTED');
      }
    });

    it('should include helpful error message mentioning ScreenCaptureKit', async () => {
      const target: ScreenshotTarget = {
        type: 'region',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      };

      try {
        await engine.takeScreenshot(target);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.message).toContain('ScreenCaptureKit');
        expect(screenshotError.message).toContain('not yet implemented');
        expect(screenshotError.message).toContain('macOS');
      }
    });

    it('should suggest using URL-based screenshots in error message', async () => {
      const target: ScreenshotTarget = {
        type: 'region',
        x: 50,
        y: 50,
        width: 500,
        height: 400
      };

      try {
        await engine.takeScreenshot(target);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.message).toContain('URL-based screenshots');
        expect(screenshotError.message).toContain('target.type = "url"');
      }
    });
  });

  describe('Output Directory Management', () => {
    it('should return current output directory', () => {
      const dir = engine.getOutputDirectory();
      expect(typeof dir).toBe('string');
      expect(dir.length).toBeGreaterThan(0);
    });

    it('should allow changing output directory', () => {
      const newDir = '/tmp/test-screenshots';
      engine.setOutputDirectory(newDir);
      expect(engine.getOutputDirectory()).toBe(newDir);
    });
  });
});
