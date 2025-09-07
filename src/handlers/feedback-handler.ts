import { container } from '../core/container.js';
import { createLogger } from '../core/logger.js';
import { SERVICE_TOKENS, IFeedbackAnalyzer } from '../interfaces/index.js';
import { AnalyzeFeedbackParamsSchema } from '../types/index.js';

const logger = createLogger('FeedbackHandler');

export async function handleAnalyzeFeedback(request: any) {
  const params = AnalyzeFeedbackParamsSchema.parse(request.params.arguments);
  const feedbackAnalyzer = container.resolve<IFeedbackAnalyzer>(SERVICE_TOKENS.FEEDBACK_ANALYZER);

  logger.debug('Analyzing feedback', {
    diffImagePath: params.diffImagePath,
    priority: params.options?.priority,
    suggestionsType: params.options?.suggestionsType
  });

  const result = await feedbackAnalyzer.analyzeDifferences(params.diffImagePath, params.options);

  logger.info('Feedback analysis completed', {
    issuesCount: result.issues.length,
    suggestionsCount: result.suggestions.length,
    confidence: result.confidence
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
