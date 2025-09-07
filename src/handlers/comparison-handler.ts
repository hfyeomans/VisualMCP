import { container } from '../core/container.js';
import { createLogger } from '../core/logger.js';
import { SERVICE_TOKENS, IComparisonEngine } from '../interfaces/index.js';
import { CompareVisualsParamsSchema } from '../types/index.js';

const logger = createLogger('ComparisonHandler');

export async function handleCompareVisuals(request: any) {
  const params = CompareVisualsParamsSchema.parse(request.params.arguments);
  const comparisonEngine = container.resolve<IComparisonEngine>(SERVICE_TOKENS.COMPARISON_ENGINE);

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
}
