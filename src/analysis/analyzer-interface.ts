import { Issue, Suggestion } from '../types/index.js';

/**
 * Base interface for all visual analyzers
 * Allows pluggable analyzer strategies for different analysis types
 */
export interface IAnalyzer<TAnalysis = unknown> {
  /**
   * The type of analysis this analyzer performs
   */
  readonly type: string;

  /**
   * Analyze an image and return analysis results
   */
  analyze(imagePath: string): Promise<TAnalysis>;

  /**
   * Detect issues from analysis results
   */
  detectIssues(analysis: TAnalysis): Issue[];

  /**
   * Generate suggestions from issues
   */
  generateSuggestions(issues: Issue[]): Suggestion[];
}

/**
 * Registry for managing analyzers
 */
export class AnalyzerRegistry {
  private analyzers = new Map<string, IAnalyzer>();

  /**
   * Register an analyzer
   */
  register(analyzer: IAnalyzer): void {
    this.analyzers.set(analyzer.type, analyzer);
  }

  /**
   * Get an analyzer by type
   */
  get(type: string): IAnalyzer | undefined {
    return this.analyzers.get(type);
  }

  /**
   * Get all registered analyzers
   */
  getAll(): IAnalyzer[] {
    return Array.from(this.analyzers.values());
  }

  /**
   * Get analyzers for specific priorities
   */
  getForPriorities(priorities: string[]): IAnalyzer[] {
    const analyzers: IAnalyzer[] = [];

    for (const priority of priorities) {
      // Map priorities to analyzer types
      if (priority === 'colors' && this.analyzers.has('color')) {
        analyzers.push(this.analyzers.get('color')!);
      }
      if (
        (priority === 'layout' || priority === 'spacing' || priority === 'typography') &&
        this.analyzers.has('layout')
      ) {
        const layoutAnalyzer = this.analyzers.get('layout');
        if (layoutAnalyzer && !analyzers.includes(layoutAnalyzer)) {
          analyzers.push(layoutAnalyzer);
        }
      }
    }

    return analyzers;
  }

  /**
   * Check if an analyzer is registered
   */
  has(type: string): boolean {
    return this.analyzers.has(type);
  }

  /**
   * Clear all analyzers
   */
  clear(): void {
    this.analyzers.clear();
  }
}
