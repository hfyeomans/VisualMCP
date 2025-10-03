import { IFeedbackAnalyzer } from '../interfaces/index.js';
import { FeedbackOptions, FeedbackResult, Issue, Suggestion } from '../types/index.js';
import { createLogger } from '../core/logger.js';
import { DiffImageNotFoundError, AnalysisError } from '../core/errors.js';
import { fileManager } from '../utils/file-utils.js';
import { AnalyzerRegistry } from './analyzer-interface.js';
import { MetadataPersistenceService } from './metadata-persistence.js';

const logger = createLogger('FeedbackGenerator');

/**
 * Orchestrates analysis and generates comprehensive feedback
 */
export class FeedbackGenerator implements IFeedbackAnalyzer {
  constructor(
    private readonly analyzerRegistry: AnalyzerRegistry,
    private readonly metadataPersistence?: MetadataPersistenceService
  ) {}

  async analyzeDifferences(
    diffImagePath: string,
    options: FeedbackOptions = {}
  ): Promise<FeedbackResult> {
    try {
      logger.info('Starting feedback analysis', {
        diffImagePath,
        priorities: options.priority,
        suggestionsType: options.suggestionsType
      });

      // Validate input
      if (!(await fileManager.exists(diffImagePath))) {
        throw new DiffImageNotFoundError(diffImagePath);
      }

      const priorities = options.priority || ['layout'];
      const context = options.context || '';
      const suggestionsType = options.suggestionsType || 'both';

      // Get analyzers for requested priorities
      const analyzers = this.analyzerRegistry.getForPriorities(priorities);

      if (analyzers.length === 0) {
        logger.warn('No analyzers available for priorities', { priorities });
      }

      // Run all analyzers
      const allIssues: Issue[] = [];
      const allSuggestions: Suggestion[] = [];

      for (const analyzer of analyzers) {
        try {
          logger.debug('Running analyzer', { type: analyzer.type });

          // Run analysis
          const analysis = await analyzer.analyze(diffImagePath);

          // Detect issues
          const issues = analyzer.detectIssues(analysis);
          allIssues.push(...issues);

          // Generate suggestions
          const suggestions = analyzer.generateSuggestions(issues);
          allSuggestions.push(...suggestions);

          logger.debug('Analyzer completed', {
            type: analyzer.type,
            issuesCount: issues.length,
            suggestionsCount: suggestions.length
          });
        } catch (error) {
          logger.warn(
            `Analyzer ${analyzer.type} failed, continuing without it`,
            { diffImagePath },
            error as Error
          );
        }
      }

      // Filter suggestions by type
      const filteredSuggestions =
        suggestionsType === 'both'
          ? allSuggestions
          : allSuggestions.filter(s => s.type === suggestionsType);

      // Deduplicate and sort suggestions
      const uniqueSuggestions = this.deduplicateSuggestions(filteredSuggestions);
      uniqueSuggestions.sort((a, b) => a.priority - b.priority);

      // Calculate confidence
      const confidence = this.calculateConfidence(allIssues, analyzers.length);

      // Generate summary
      const summary = this.generateSummary(allIssues, uniqueSuggestions, context);

      const result: FeedbackResult = {
        summary,
        issues: allIssues,
        suggestions: uniqueSuggestions,
        priority: priorities.join(', '),
        confidence
      };

      // Persist metadata if enabled
      if (this.metadataPersistence) {
        try {
          await this.metadataPersistence.saveMetadata(diffImagePath, result);
        } catch (error) {
          logger.warn('Failed to persist metadata', { diffImagePath }, error as Error);
        }
      }

      logger.info('Feedback analysis completed', {
        diffImagePath,
        issuesCount: allIssues.length,
        suggestionsCount: uniqueSuggestions.length,
        confidence
      });

      return result;
    } catch (error) {
      if (error instanceof DiffImageNotFoundError) {
        throw error;
      }

      logger.error('Feedback analysis failed', error as Error, { diffImagePath });
      throw new AnalysisError(
        `Failed to analyze differences: ${(error as Error).message}`,
        'FEEDBACK_ANALYSIS_FAILED',
        error as Error
      );
    }
  }

  private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.type}-${suggestion.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private calculateConfidence(issues: Issue[], analyzersCount: number): number {
    let confidence = 100;

    // Reduce confidence based on number of issues
    confidence -= Math.min(issues.length * 3, 20);

    // Reduce confidence more for high severity issues
    const severityPenalty = issues.reduce((penalty, issue) => {
      switch (issue.severity) {
        case 'critical':
          return penalty + 15;
        case 'high':
          return penalty + 10;
        case 'medium':
          return penalty + 5;
        case 'low':
          return penalty + 2;
        default:
          return penalty;
      }
    }, 0);

    confidence -= severityPenalty;

    // Reduce confidence if no analyzers ran
    if (analyzersCount === 0) {
      confidence -= 30;
    } else if (analyzersCount === 1) {
      confidence -= 10;
    }

    // Boost confidence if we have multiple analyzers
    if (analyzersCount >= 2) {
      confidence += 5;
    }

    return Math.max(10, Math.min(100, Math.round(confidence)));
  }

  private generateSummary(issues: Issue[], suggestions: Suggestion[], context: string): string {
    if (issues.length === 0) {
      return 'No significant visual differences detected. The current implementation closely matches the reference design.';
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;

    let summary = `Analysis detected ${issues.length} visual difference${issues.length > 1 ? 's' : ''}.`;

    if (criticalIssues > 0) {
      summary += ` ${criticalIssues} critical issue${criticalIssues > 1 ? 's' : ''} requiring immediate attention.`;
    }

    if (highIssues > 0) {
      summary += ` ${highIssues} high priority issue${highIssues > 1 ? 's' : ''} should be addressed.`;
    }

    if (mediumIssues > 0) {
      summary += ` ${mediumIssues} medium priority issue${mediumIssues > 1 ? 's' : ''} detected.`;
    }

    if (context) {
      summary += ` Context: ${context}.`;
    }

    summary += ` ${suggestions.length} actionable suggestion${suggestions.length > 1 ? 's' : ''} provided for improvement.`;

    return summary;
  }
}
