import { ConfigManager } from '../../core/config.js';

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv;
  delete process.env.VISUAL_MCP_SCREENSHOT_QUALITY;
  delete process.env.VISUAL_MCP_SCREENSHOT_FORMAT;
  delete process.env.VISUAL_MCP_TOLERANCE;
};

describe('ConfigManager', () => {
  afterEach(() => {
    ConfigManager.resetForTesting();
    resetEnv();
  });

  it('applies environment overrides without losing defaults', () => {
    process.env.VISUAL_MCP_SCREENSHOT_QUALITY = '72';
    process.env.VISUAL_MCP_SCREENSHOT_FORMAT = 'jpeg';

    ConfigManager.resetForTesting();
    const manager = ConfigManager.getInstance();
    const config = manager.getConfig();

    expect(config.screenshot.defaultQuality).toBe(72);
    expect(config.screenshot.defaultFormat).toBe('jpeg');
    // Defaults should remain intact
    expect(config.screenshot.defaultViewport).toEqual({ width: 1200, height: 800 });
  });

  it('deep merges nested config updates', () => {
    const manager = ConfigManager.getInstance();

    manager.updateConfig({
      screenshot: {
        defaultQuality: 55
      }
    });

    const updated = manager.getConfig();
    expect(updated.screenshot.defaultQuality).toBe(55);
    // Nested defaults remain untouched
    expect(updated.screenshot.defaultViewport.width).toBe(1200);
    expect(updated.screenshot.defaultViewport.height).toBe(800);
  });
});
