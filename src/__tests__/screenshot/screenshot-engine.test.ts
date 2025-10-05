import { ScreenshotError } from '../../core/errors.js';
import {
  IBrowserManager,
  IFileManager,
  IImageProcessor,
  INativeCaptureManager
} from '../../interfaces/index.js';
import { ScreenshotEngine } from '../../screenshot/puppeteer.js';
import { ScreenshotTarget, NativeCaptureResult } from '../../types/index.js';

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

  describe('Region Capture - Without Native Manager', () => {
    it('should throw ScreenshotError when no native capture manager', async () => {
      const target: ScreenshotTarget = {
        type: 'region',
        x: 100,
        y: 100,
        width: 800,
        height: 600
      };

      await expect(engine.takeScreenshot(target)).rejects.toThrow(ScreenshotError);
    });

    it('should throw error with NATIVE_CAPTURE_UNAVAILABLE code', async () => {
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
        expect(screenshotError.code).toBe('NATIVE_CAPTURE_UNAVAILABLE');
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
        expect(screenshotError.message).toContain('not available');
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

  describe('Region Capture - With Native Manager', () => {
    let mockNativeManager: INativeCaptureManager;
    let engineWithNative: ScreenshotEngine;

    beforeEach(() => {
      mockNativeManager = {
        captureInteractive: jest.fn(),
        captureRegion: jest.fn(),
        isAvailable: jest.fn().mockResolvedValue(true),
        getPlatform: jest.fn().mockReturnValue('macos'),
        cleanup: jest.fn()
      };

      engineWithNative = new ScreenshotEngine(
        mockBrowserManager,
        mockFileManager,
        mockImageProcessor,
        mockNativeManager
      );
    });

    it('should delegate to native manager when available', async () => {
      const target: ScreenshotTarget = {
        type: 'region',
        x: 100,
        y: 100,
        width: 800,
        height: 600
      };

      const mockResult: NativeCaptureResult = {
        filepath: '/tmp/screenshot.png',
        width: 800,
        height: 600,
        format: 'png',
        size: 12345,
        timestamp: new Date().toISOString()
      };

      (mockNativeManager.captureRegion as jest.Mock).mockResolvedValue(mockResult);

      const result = await engineWithNative.takeScreenshot(target);

      expect(mockNativeManager.isAvailable).toHaveBeenCalled();
      expect(mockNativeManager.captureRegion).toHaveBeenCalledWith({
        x: 100,
        y: 100,
        width: 800,
        height: 600
      });
      expect(result.filepath).toBe('/tmp/screenshot.png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should throw error if platform not available', async () => {
      (mockNativeManager.isAvailable as jest.Mock).mockResolvedValue(false);
      (mockNativeManager.getPlatform as jest.Mock).mockReturnValue('none');

      const target: ScreenshotTarget = {
        type: 'region',
        x: 100,
        y: 100,
        width: 800,
        height: 600
      };

      try {
        await engineWithNative.takeScreenshot(target);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScreenshotError);
        const screenshotError = error as ScreenshotError;
        expect(screenshotError.code).toBe('PLATFORM_NOT_SUPPORTED');
      }
    });

    it('should cleanup native manager on engine cleanup', async () => {
      await engineWithNative.cleanup();
      expect(mockNativeManager.cleanup).toHaveBeenCalled();
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
