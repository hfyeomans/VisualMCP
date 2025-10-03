import { createLogger } from '../core/logger.js';
import { IFeedbackAnalyzer } from '../interfaces/index.js';
import {
  AnalyzeFeedbackParamsSchema,
  MCPToolHandler,
  MCPToolRequest,
  MCPToolResponse
} from '../types/index.js';

const logger = createLogger('FeedbackHandler');

export type FeedbackHandler = MCPToolHandler;

export function createAnalyzeFeedbackHandler(feedbackAnalyzer: IFeedbackAnalyzer): FeedbackHandler {
  return async function handleAnalyzeFeedback(request: MCPToolRequest): Promise<MCPToolResponse> {
    const params = AnalyzeFeedbackParamsSchema.parse(request.params.arguments);

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
  };
}
