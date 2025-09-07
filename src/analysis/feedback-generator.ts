import { ColorAnalyzer, ColorAnalysis } from './color-analyzer.js';
import { LayoutAnalyzer, LayoutAnalysis } from './layout-analyzer.js';
import { IFeedbackAnalyzer } from '../interfaces/index.js';
import { FeedbackOptions, FeedbackResult, Issue, Suggestion } from '../types/index.js';
import { createLogger } from '../core/logger.js';
import { DiffImageNotFoundError, AnalysisError } from '../core/errors.js';
import { fileManager } from '../utils/file-utils.js';

const logger = createLogger('FeedbackGenerator');

/**
 * Orchestrates analysis and generates comprehensive feedback
 */
export class FeedbackGenerator implements IFeedbackAnalyzer {
  private colorAnalyzer: ColorAnalyzer;
  private layoutAnalyzer: LayoutAnalyzer;

  constructor(
    colorAnalyzer?: ColorAnalyzer,
    layoutAnalyzer?: LayoutAnalyzer
  ) {
    this.colorAnalyzer = colorAnalyzer || new ColorAnalyzer();
    this.layoutAnalyzer = layoutAnalyzer || new LayoutAnalyzer();
  }

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
      if (!await fileManager.exists(diffImagePath)) {
        throw new DiffImageNotFoundError(diffImagePath);
      }

      const priorities = options.priority || ['layout'];
      const context = options.context || '';
      const suggestionsType = options.suggestionsType || 'both';

      // Perform analysis based on priorities
      const analyses = await this.performAnalyses(diffImagePath, priorities);
      
      // Generate issues and suggestions
      const issues = await this.generateIssues(analyses, priorities);
      const suggestions = await this.generateSuggestions(issues, analyses, suggestionsType);
      
      // Calculate confidence based on analysis quality
      const confidence = this.calculateConfidence(issues, analyses);
      
      // Generate summary
      const summary = this.generateSummary(issues, suggestions, context);

      const result: FeedbackResult = {
        summary,
        issues,
        suggestions,
        priority: priorities.join(', '),
        confidence
      };

      logger.info('Feedback analysis completed', {
        diffImagePath,
        issuesCount: issues.length,
        suggestionsCount: suggestions.length,
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

  private async performAnalyses(
    diffImagePath: string, 
    priorities: string[]
  ): Promise<{
    color?: ColorAnalysis;
    layout?: LayoutAnalysis;
  }> {
    const analyses: { color?: ColorAnalysis; layout?: LayoutAnalysis } = {};

    // Perform color analysis if requested
    if (priorities.includes('colors')) {
      try {
        logger.debug('Performing color analysis');
        analyses.color = await this.colorAnalyzer.analyzeColors(diffImagePath);
      } catch (error) {
        logger.warn('Color analysis failed, continuing without it', { diffImagePath }, error as Error);
      }
    }

    // Perform layout analysis if requested  
    if (priorities.includes('layout') || priorities.includes('spacing') || priorities.includes('typography')) {
      try {
        logger.debug('Performing layout analysis');
        analyses.layout = await this.layoutAnalyzer.analyzeLayout(diffImagePath);
      } catch (error) {
        logger.warn('Layout analysis failed, continuing without it', { diffImagePath }, error as Error);
      }
    }

    return analyses;
  }

  private async generateIssues(
    analyses: { color?: ColorAnalysis; layout?: LayoutAnalysis },
    priorities: string[]
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Generate color issues
    if (analyses.color && priorities.includes('colors')) {
      const colorIssues = this.colorAnalyzer.detectColorIssues(analyses.color);
      issues.push(...colorIssues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        description: issue.description
      })));
    }

    // Generate layout issues
    if (analyses.layout) {
      if (priorities.includes('layout')) {
        // Add layout shift issues
        for (const shift of analyses.layout.layoutShifts) {
          issues.push({
            type: 'layout',
            severity: shift.severity,
            description: shift.description,
            location: shift.region
          });
        }

        // Add alignment issues
        for (const alignment of analyses.layout.alignmentIssues) {
          issues.push({
            type: 'layout',
            severity: 'medium',
            description: alignment.description,
            location: alignment.region
          });
        }
      }

      if (priorities.includes('spacing')) {
        // Add spacing issues
        for (const spacing of analyses.layout.spacingIssues) {
          issues.push({
            type: 'spacing',
            severity: 'low',
            description: spacing.description,
            location: spacing.region
          });
        }
      }

      if (priorities.includes('typography')) {
        // Add typography issues (simplified detection based on region characteristics)
        for (const region of analyses.layout.regions) {
          if (region.height < 30 && region.width > 100) {
            issues.push({
              type: 'typography',
              severity: 'medium',
              description: 'Potential text rendering differences detected',
              location: region
            });
          }
        }
      }
    }

    logger.debug('Issues generated', { 
      totalCount: issues.length,
      byType: this.groupIssuesByType(issues)
    });

    return issues;
  }

  private async generateSuggestions(
    issues: Issue[],
    analyses: { color?: ColorAnalysis; layout?: LayoutAnalysis },
    suggestionsType: 'css' | 'general' | 'both'
  ): Promise<Suggestion[]> {
    let suggestions: Suggestion[] = [];

    // Generate color-based suggestions
    if (analyses.color) {
      const colorSuggestions = this.colorAnalyzer.generateColorSuggestions(
        analyses.color,
        issues.filter(issue => issue.type === 'colors')
      );
      suggestions.push(...colorSuggestions.filter(s => 
        suggestionsType === 'both' || s.type === suggestionsType
      ));
    }

    // Generate layout-based suggestions
    if (analyses.layout) {
      const layoutSuggestions = this.layoutAnalyzer.generateLayoutSuggestions(analyses.layout);
      suggestions.push(...layoutSuggestions.filter(s => 
        suggestionsType === 'both' || s.type === suggestionsType
      ));
    }

    // Generate generic suggestions based on issue types
    const genericSuggestions = this.generateGenericSuggestions(issues, suggestionsType);
    suggestions.push(...genericSuggestions);

    // Sort by priority and remove duplicates
    suggestions = this.deduplicateSuggestions(suggestions);
    suggestions.sort((a, b) => a.priority - b.priority);

    logger.debug('Suggestions generated', { 
      totalCount: suggestions.length,
      byType: suggestions.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    return suggestions;
  }

  private generateGenericSuggestions(
    issues: Issue[],
    suggestionsType: 'css' | 'general' | 'both'
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const issueTypes = new Set(issues.map(i => i.type));

    // Generic typography suggestions
    if (issueTypes.has('typography') && (suggestionsType === 'general' || suggestionsType === 'both')) {
      suggestions.push({
        type: 'general',
        title: 'Typography Review',
        description: 'Check font family, size, weight, and line height consistency',
        priority: 2
      });
    }

    // Generic content suggestions
    if (issues.some(i => i.description.includes('content')) && 
        (suggestionsType === 'general' || suggestionsType === 'both')) {
      suggestions.push({
        type: 'general',
        title: 'Content Review',
        description: 'Review text content, images, and other media for accuracy',
        priority: 3
      });
    }

    return suggestions;
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

  private calculateConfidence(
    issues: Issue[],
    analyses: { color?: ColorAnalysis; layout?: LayoutAnalysis }
  ): number {
    let confidence = 100;

    // Reduce confidence based on number of issues
    confidence -= Math.min(issues.length * 3, 20);

    // Reduce confidence more for high severity issues
    const severityPenalty = issues.reduce((penalty, issue) => {
      switch (issue.severity) {
        case 'critical': return penalty + 15;
        case 'high': return penalty + 10;
        case 'medium': return penalty + 5;
        case 'low': return penalty + 2;
        default: return penalty;
      }
    }, 0);

    confidence -= severityPenalty;

    // Reduce confidence if analyses failed
    if (!analyses.color && !analyses.layout) {
      confidence -= 30;
    } else if (!analyses.color || !analyses.layout) {
      confidence -= 15;
    }

    // Boost confidence if we have good data
    if (analyses.color && analyses.layout) {
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

  private groupIssuesByType(issues: Issue[]): Record<string, number> {
    return issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}