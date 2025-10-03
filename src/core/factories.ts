import { container } from './container.js';
import { browserManager } from './browser-manager.js';
import { cleanupManager } from './resource-manager.js';
import {
  SERVICE_TOKENS,
  IScreenshotEngine,
  IComparisonEngine,
  IFeedbackAnalyzer,
  IMonitoringManager,
  IFileManager,
  IImageProcessor
} from '../interfaces/index.js';
import { ScreenshotEngine } from '../screenshot/puppeteer.js';
import { ComparisonEngine } from '../comparison/differ.js';
import { FeedbackGenerator } from '../analysis/feedback-generator.js';
import { MonitoringManager } from '../screenshot/monitoring.js';
import { fileManager } from '../utils/file-utils.js';
import { imageProcessor } from '../utils/image-utils.js';

let servicesRegistered = false;
let servicesInitialized = false;

export function registerCoreServices(): void {
  if (servicesRegistered) {
    return;
  }

  container.registerInstance(SERVICE_TOKENS.BROWSER_MANAGER, browserManager);
  container.registerInstance<IFileManager>(SERVICE_TOKENS.FILE_MANAGER, fileManager);
  container.registerInstance<IImageProcessor>(SERVICE_TOKENS.IMAGE_PROCESSOR, imageProcessor);

  container.registerSingleton<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE, () => {
    return new ScreenshotEngine(browserManager, fileManager, imageProcessor);
  });

  container.registerSingleton<IComparisonEngine>(SERVICE_TOKENS.COMPARISON_ENGINE, () => {
    return new ComparisonEngine();
  });

  container.registerSingleton<IFeedbackAnalyzer>(SERVICE_TOKENS.FEEDBACK_ANALYZER, () => {
    return new FeedbackGenerator();
  });

  container.registerSingleton<IMonitoringManager>(SERVICE_TOKENS.MONITORING_MANAGER, () => {
    const screenshotEngine = container.resolve<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE);
    const comparisonEngine = container.resolve<IComparisonEngine>(SERVICE_TOKENS.COMPARISON_ENGINE);
    return new MonitoringManager(screenshotEngine, comparisonEngine);
  });

  servicesRegistered = true;
}

export async function initializeCoreServices(): Promise<void> {
  if (servicesInitialized) {
    return;
  }

  const screenshotEngine = container.resolve<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE);
  await screenshotEngine.init();

  const comparisonEngine = container.resolve<IComparisonEngine>(SERVICE_TOKENS.COMPARISON_ENGINE);
  await comparisonEngine.init();

  const monitoringManager = container.resolve<IMonitoringManager>(
    SERVICE_TOKENS.MONITORING_MANAGER
  );

  cleanupManager.removeCleanupHandler('MonitoringManager');
  cleanupManager.registerCleanupHandler('MonitoringManager', async () => {
    await monitoringManager.cleanup();
  });

  servicesInitialized = true;
}

export function resetFactoryStateForTests(): void {
  servicesRegistered = false;
  servicesInitialized = false;
}
