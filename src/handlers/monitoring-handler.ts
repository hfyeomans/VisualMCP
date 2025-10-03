import { createLogger } from '../core/logger.js';
import { IMonitoringManager } from '../interfaces/index.js';
import {
  StartMonitoringParamsSchema,
  StopMonitoringParamsSchema,
  MCPToolHandler,
  MCPToolRequest,
  MCPToolResponse
} from '../types/index.js';

const logger = createLogger('MonitoringHandler');

export type StartMonitoringHandler = MCPToolHandler;
export type StopMonitoringHandler = MCPToolHandler;

export function createStartMonitoringHandler(
  monitoringManager: IMonitoringManager
): StartMonitoringHandler {
  return async function handleStartMonitoring(request: MCPToolRequest): Promise<MCPToolResponse> {
    const params = StartMonitoringParamsSchema.parse(request.params.arguments);

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
  };
}

export function createStopMonitoringHandler(
  monitoringManager: IMonitoringManager
): StopMonitoringHandler {
  return async function handleStopMonitoring(request: MCPToolRequest): Promise<MCPToolResponse> {
    const params = StopMonitoringParamsSchema.parse(request.params.arguments);

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
  };
}
