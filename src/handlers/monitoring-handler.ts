import { container } from '../core/container.js';
import { createLogger } from '../core/logger.js';
import { SERVICE_TOKENS, IMonitoringManager } from '../interfaces/index.js';
import { StartMonitoringParamsSchema, StopMonitoringParamsSchema } from '../types/index.js';

const logger = createLogger('MonitoringHandler');

export async function handleStartMonitoring(request: any) {
  const params = StartMonitoringParamsSchema.parse(request.params.arguments);
  const monitoringManager = container.resolve<IMonitoringManager>(
    SERVICE_TOKENS.MONITORING_MANAGER
  );

  logger.debug('Starting monitoring', {
    targetType: params.target.type,
    interval: params.interval,
    autoFeedback: params.autoFeedback
  });

  const sessionId = await monitoringManager.startMonitoring(params);

  logger.info('Monitoring started', {
    sessionId,
    interval: params.interval
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            sessionId,
            message: 'Monitoring started successfully'
          },
          null,
          2
        )
      }
    ]
  };
}

export async function handleStopMonitoring(request: any) {
  const params = StopMonitoringParamsSchema.parse(request.params.arguments);
  const monitoringManager = container.resolve<IMonitoringManager>(
    SERVICE_TOKENS.MONITORING_MANAGER
  );

  logger.debug('Stopping monitoring', { sessionId: params.sessionId });

  const summary = await monitoringManager.stopMonitoring(params.sessionId);

  logger.info('Monitoring stopped', {
    sessionId: params.sessionId,
    duration: summary.duration,
    screenshotsCount: summary.totalScreenshots
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(summary, null, 2)
      }
    ]
  };
}
