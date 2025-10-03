import { Page } from 'puppeteer';
import { BrowserSession } from '../../screenshot/browser-session.js';
import { ScreenshotTimeoutError, ScreenshotNavigationError } from '../../core/errors.js';

// Mock Puppeteer Page
interface MockPage {
  setViewport: jest.Mock;
  goto: jest.Mock;
  evaluate: jest.Mock;
}

function createMockPage(): MockPage {
  return {
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue(undefined)
  };
}

describe('BrowserSession', () => {
  let browserSession: BrowserSession;

  beforeEach(() => {
    browserSession = new BrowserSession();
  });

  describe('setupPage', () => {
    it('sets viewport when provided', async () => {
      const mockPage = createMockPage();
      const viewport = { width: 1920, height: 1080 };

      await browserSession.setupPage(mockPage as unknown as Page, 'https://example.com', {
        viewport,
        timeout: 30000,
        waitForNetworkIdle: false
      });

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      });
    });

    it('skips viewport setup when not provided', async () => {
      const mockPage = createMockPage();

      await browserSession.setupPage(mockPage as unknown as Page, 'https://example.com', {
        timeout: 30000,
        waitForNetworkIdle: false
      });

      expect(mockPage.setViewport).not.toHaveBeenCalled();
    });

    it('navigates to URL with network idle when enabled', async () => {
      const mockPage = createMockPage();

      await browserSession.setupPage(mockPage as unknown as Page, 'https://example.com', {
        timeout: 30000,
        waitForNetworkIdle: true
      });

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
    });

    it('navigates to URL with load when network idle disabled', async () => {
      const mockPage = createMockPage();

      await browserSession.setupPage(mockPage as unknown as Page, 'https://example.com', {
        timeout: 30000,
        waitForNetworkIdle: false
      });

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 30000
      });
    });

    it('throws ScreenshotTimeoutError when navigation times out', async () => {
      const mockPage = createMockPage();
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout exceeded'));

      await expect(
        browserSession.setupPage(mockPage as unknown as Page, 'https://example.com', {
          timeout: 5000,
          waitForNetworkIdle: false
        })
      ).rejects.toThrow(ScreenshotTimeoutError);
    });

    it('throws ScreenshotNavigationError for other navigation errors', async () => {
      const mockPage = createMockPage();
      mockPage.goto.mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED'));

      await expect(
        browserSession.setupPage(mockPage as unknown as Page, 'https://invalid.local', {
          timeout: 30000,
          waitForNetworkIdle: false
        })
      ).rejects.toThrow(ScreenshotNavigationError);
    });

    it('waits for page stability after navigation', async () => {
      const mockPage = createMockPage();
      mockPage.evaluate.mockImplementation(() => {
        // Simulate the page stability check
        return Promise.resolve();
      });

      await browserSession.setupPage(mockPage as unknown as Page, 'https://example.com', {
        timeout: 30000,
        waitForNetworkIdle: false
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });
});
