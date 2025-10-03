import { createLogger } from '../core/logger.js';
import { IScreenshotEngine } from '../interfaces/index.js';
import {
  TakeScreenshotParamsSchema,
  MCPToolHandler,
  MCPToolRequest,
  MCPToolResponse
} from '../types/index.js';

const logger = createLogger('ScreenshotHandler');

export type ScreenshotHandler = MCPToolHandler;

export function createTakeScreenshotHandler(
  screenshotEngine: IScreenshotEngine
): ScreenshotHandler {
  return async function handleTakeScreenshot(request: MCPToolRequest): Promise<MCPToolResponse> {
    const params = TakeScreenshotParamsSchema.parse(request.params.arguments);

    logger.debug('Taking screenshot', {
      targetType: params.target.type,
      format: params.options?.format
    });

    const result = await screenshotEngine.takeScreenshot(params.target, params.options);

    logger.info('Screenshot taken successfully', {
      filepath: result.filepath,
      size: result.size,
      dimensions: `${result.width}x${result.height}`
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  };
}
