import { createLogger } from '../core/logger.js';
import { IComparisonEngine } from '../interfaces/index.js';
import {
  CompareVisualsParamsSchema,
  MCPToolHandler,
  MCPToolRequest,
  MCPToolResponse
} from '../types/index.js';

const logger = createLogger('ComparisonHandler');

export type ComparisonHandler = MCPToolHandler;

export function createCompareVisualsHandler(
  comparisonEngine: IComparisonEngine
): ComparisonHandler {
  return async function handleCompareVisuals(request: MCPToolRequest): Promise<MCPToolResponse> {
    const params = CompareVisualsParamsSchema.parse(request.params.arguments);

    logger.debug('Comparing images', {
      currentImage: params.currentImage,
      referenceImage: params.referenceImage,
      tolerance: params.options?.tolerance
    });

    const result = await comparisonEngine.compare(
      params.currentImage,
      params.referenceImage,
      params.options
    );

    logger.info('Visual comparison completed', {
      differencePercentage: result.differencePercentage,
      isMatch: result.isMatch,
      regionsCount: result.regions.length
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
