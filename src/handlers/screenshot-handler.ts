import { container } from '../core/container.js';
import { createLogger } from '../core/logger.js';
import { SERVICE_TOKENS, IScreenshotEngine } from '../interfaces/index.js';
import { TakeScreenshotParamsSchema } from '../types/index.js';

const logger = createLogger('ScreenshotHandler');

export async function handleTakeScreenshot(request: any) {
  const params = TakeScreenshotParamsSchema.parse(request.params.arguments);
  const screenshotEngine = container.resolve<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE);

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
}
