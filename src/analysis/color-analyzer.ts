import sharp from 'sharp';
import { createLogger } from '../core/logger.js';
import { ImageUtils } from '../utils/image-utils.js';
import { AnalysisError } from '../core/errors.js';
import { Issue, Suggestion } from '../types/index.js';
import { IAnalyzer } from './analyzer-interface.js';

const logger = createLogger('ColorAnalyzer');

export interface ColorAnalysis {
  dominantColors: Array<{ color: string; percentage: number }>;
  contrast: number;
  brightness: number;
  colorDiversity: number;
  redPixels: number;
  yellowPixels: number;
}

export interface ColorAnalyzerThresholds {
  lowContrastThreshold: number;
  highRedPixelPercentage: number;
  lowColorDiversityThreshold: number;
  veryBrightThreshold: number;
  veryDarkThreshold: number;
}

/**
 * Handles color analysis of images for visual feedback
 */
export class ColorAnalyzer implements IAnalyzer<ColorAnalysis> {
  readonly type = 'color';

  constructor(private readonly thresholds: ColorAnalyzerThresholds) {}
  async analyze(imagePath: string): Promise<ColorAnalysis> {
    try {
      logger.debug('Starting color analysis', { imagePath });

      const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });

      const analysis = this.performColorAnalysis(data, info.channels);

      logger.debug('Color analysis completed', {
        imagePath,
        dominantColorsCount: analysis.dominantColors.length,
        contrast: analysis.contrast,
        brightness: Math.round(analysis.brightness)
      });

      return analysis;
    } catch (error) {
      logger.error('Color analysis failed', error as Error, { imagePath });
      throw new AnalysisError(
        `Failed to analyze colors for image: ${imagePath}`,
        'COLOR_ANALYSIS_FAILED',
        error as Error
      );
    }
  }

  private performColorAnalysis(data: Buffer, channels: number): ColorAnalysis {
    let totalBrightness = 0;
    let totalPixels = 0;
    let redPixels = 0;
    let yellowPixels = 0;

    const colorCounts = new Map<string, number>();
    const uniqueColors = new Set<string>();

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;

      // Track unique colors for diversity calculation
      const colorKey = `${r},${g},${b}`;
      uniqueColors.add(colorKey);

      // Track red pixels (differences in visual comparisons)
      if (r > 200 && g < 100 && b < 100) {
        redPixels++;
      }

      // Track yellow pixels (AA differences in visual comparisons)
      if (r > 200 && g > 200 && b < 100) {
        yellowPixels++;
      }

      // Calculate brightness
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;
      totalPixels++;

      // Group colors for dominant color detection (reduce precision for better grouping)
      const groupedColorKey = `${Math.floor(r / 32)},${Math.floor(g / 32)},${Math.floor(b / 32)}`;
      colorCounts.set(groupedColorKey, (colorCounts.get(groupedColorKey) || 0) + 1);
    }

    // Extract dominant colors
    const dominantColors = ImageUtils.extractDominantColors(data, channels, 5);

    // Calculate metrics
    const brightness = totalPixels > 0 ? totalBrightness / totalPixels : 0;
    const contrast = ImageUtils.calculateContrast(data, channels);
    const colorDiversity = totalPixels > 0 ? uniqueColors.size / totalPixels : 0;

    return {
      dominantColors,
      contrast,
      brightness,
      colorDiversity,
      redPixels,
      yellowPixels
    };
  }

  /**
   * Detect color-related issues from analysis results
   */
  detectIssues(analysis: ColorAnalysis): Issue[] {
    const issues: Issue[] = [];

    // Low contrast issue
    if (analysis.contrast < this.thresholds.lowContrastThreshold) {
      issues.push({
        type: 'colors',
        severity: 'low',
        description: `Low color contrast detected (${Math.round(analysis.contrast)})`
      });
    }

    // Significant red differences (likely visual changes)
    const redPercentage =
      (analysis.redPixels / (analysis.redPixels + analysis.yellowPixels + 1000)) * 100;
    if (redPercentage > this.thresholds.highRedPixelPercentage) {
      issues.push({
        type: 'colors',
        severity: 'high',
        description: `Significant color differences detected (${Math.round(redPercentage)}% red pixels)`
      });
    }

    // Low color diversity (potentially washed out image)
    if (analysis.colorDiversity < this.thresholds.lowColorDiversityThreshold) {
      issues.push({
        type: 'colors',
        severity: 'medium',
        description: 'Low color diversity detected, image may be washed out'
      });
    }

    // Very bright or very dark images
    if (analysis.brightness > this.thresholds.veryBrightThreshold) {
      issues.push({
        type: 'colors',
        severity: 'medium',
        description: 'Image is very bright, may cause visibility issues'
      });
    } else if (analysis.brightness < this.thresholds.veryDarkThreshold) {
      issues.push({
        type: 'colors',
        severity: 'medium',
        description: 'Image is very dark, may cause visibility issues'
      });
    }

    logger.debug('Color issues detected', {
      issuesCount: issues.length,
      redPixels: analysis.redPixels,
      yellowPixels: analysis.yellowPixels,
      contrast: analysis.contrast,
      brightness: analysis.brightness
    });

    return issues;
  }

  /**
   * Generate color-specific feedback and suggestions
   */
  generateSuggestions(issues: Issue[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const colorIssues = issues.filter(issue => issue.type === 'colors');

    for (const issue of colorIssues) {
      if (issue.description.includes('contrast')) {
        suggestions.push({
          type: 'css' as const,
          title: 'Improve Color Contrast',
          description: 'Increase contrast between text and background colors',
          code: `/* Improve color contrast */\n.target-element {\n  /* Increase contrast between foreground and background */\n  color: #000000; /* or a darker color */\n  background-color: #ffffff; /* or a lighter background */\n  /* Consider using contrast checking tools */\n}`,
          priority: 2
        });

        suggestions.push({
          type: 'general' as const,
          title: 'Color Contrast Guidelines',
          description:
            'Follow WCAG guidelines for color contrast (4.5:1 for normal text, 3:1 for large text)',
          priority: 2
        });
      }

      if (issue.description.includes('color differences')) {
        suggestions.push({
          type: 'css' as const,
          title: 'Color Correction',
          description: 'Update colors to match the reference design',
          code: `/* Color correction based on difference analysis */\n.target-element {\n  /* Review and adjust these color properties: */\n  background-color: /* update to match reference */;\n  color: /* update text color if needed */;\n  border-color: /* update border color if applicable */;\n}`,
          priority: issue.severity === 'high' ? 1 : 2
        });
      }

      if (issue.description.includes('diversity')) {
        suggestions.push({
          type: 'general' as const,
          title: 'Color Palette Enhancement',
          description: 'Consider adding more color variation to improve visual interest',
          priority: 3
        });
      }

      if (issue.description.includes('bright') || issue.description.includes('dark')) {
        suggestions.push({
          type: 'css' as const,
          title: 'Brightness Adjustment',
          description: 'Adjust brightness levels for better visibility',
          code: `/* Brightness adjustment */\n.target-element {\n  /* Adjust brightness using filters or color values */\n  filter: brightness(0.9); /* Reduce brightness if too bright */\n  /* or adjust individual color values */\n  background-color: /* adjust to moderate brightness */;\n}`,
          priority: 2
        });
      }
    }

    logger.debug('Color suggestions generated', {
      suggestionsCount: suggestions.length,
      colorIssuesCount: colorIssues.length
    });

    return suggestions;
  }
}
