import { AnalyzerRegistry } from '../analysis/analyzer-interface.js';
import { ColorAnalyzer } from '../analysis/color-analyzer.js';
import { FeedbackGenerator } from '../analysis/feedback-generator.js';
import { LayoutAnalyzer } from '../analysis/layout-analyzer.js';
import { MetadataPersistenceService } from '../analysis/metadata-persistence.js';
import { ComparisonEngine } from '../comparison/differ.js';
import {
  SERVICE_TOKENS,
  IScreenshotEngine,
  IComparisonEngine,
  IFeedbackAnalyzer,
  IMonitoringManager,
  IFileManager,
  IImageProcessor
} from '../interfaces/index.js';
import { MonitoringManager } from '../screenshot/monitoring.js';
import { ScreenshotEngine } from '../screenshot/puppeteer.js';
import { fileManager } from '../utils/file-utils.js';
import { imageProcessor } from '../utils/image-utils.js';

import { browserManager } from './browser-manager.js';
import { config } from './config.js';
import { container } from './container.js';
import { cleanupManager } from './resource-manager.js';

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
    return new ComparisonEngine(imageProcessor);
  });

  container.registerSingleton<IFeedbackAnalyzer>(SERVICE_TOKENS.FEEDBACK_ANALYZER, () => {
    const cfg = config.getConfig();

    // Create analyzer registry
    const registry = new AnalyzerRegistry();

    // Create and register color analyzer
    const colorAnalyzer = new ColorAnalyzer(cfg.analysis.color);
    registry.register(colorAnalyzer);

    // Create and register layout analyzer
    const layoutAnalyzer = new LayoutAnalyzer(cfg.analysis.layout);
    registry.register(layoutAnalyzer);

    // Create metadata persistence service
    const metadataPersistence = new MetadataPersistenceService(
      cfg.analysis.metadataDirectory,
      cfg.analysis.enableMetadataPersistence
    );

    return new FeedbackGenerator(registry, metadataPersistence);
  });

  container.registerSingleton<IMonitoringManager>(SERVICE_TOKENS.MONITORING_MANAGER, () => {
    const cfg = config.getConfig();
    const screenshotEngine = container.resolve<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE);
    const comparisonEngine = container.resolve<IComparisonEngine>(SERVICE_TOKENS.COMPARISON_ENGINE);
    const feedbackAnalyzer = container.resolve<IFeedbackAnalyzer>(SERVICE_TOKENS.FEEDBACK_ANALYZER);

    return new MonitoringManager(screenshotEngine, comparisonEngine, feedbackAnalyzer, {
      persistSessions: cfg.monitoring.persistSessions,
      sessionsDirectory: cfg.monitoring.sessionsDirectory,
      autoFeedbackRateLimitMs: cfg.monitoring.autoFeedbackRateLimitMs,
      maxConcurrentFeedback: cfg.monitoring.maxConcurrentFeedback,
      schedulerJitterMs: cfg.monitoring.schedulerJitterMs,
      schedulerBackoffMultiplier: cfg.monitoring.schedulerBackoffMultiplier,
      schedulerMaxBackoffMs: cfg.monitoring.schedulerMaxBackoffMs
    });
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

  const feedbackAnalyzer = container.resolve<IFeedbackAnalyzer>(SERVICE_TOKENS.FEEDBACK_ANALYZER);
  // Initialize metadata persistence if FeedbackGenerator has it
  if ('metadataPersistence' in feedbackAnalyzer) {
    const generator = feedbackAnalyzer as { metadataPersistence?: { init: () => Promise<void> } };
    if (generator.metadataPersistence?.init) {
      await generator.metadataPersistence.init();
    }
  }

  const monitoringManager = container.resolve<IMonitoringManager>(
    SERVICE_TOKENS.MONITORING_MANAGER
  );

  // Initialize monitoring manager (load persisted sessions)
  if ('init' in monitoringManager) {
    const manager = monitoringManager as { init: () => Promise<void> };
    await manager.init();
  }

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
