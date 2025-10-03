import sharp from 'sharp';
import { createLogger } from '../core/logger.js';
import { AnalysisError } from '../core/errors.js';
import { DifferenceRegion, Issue, Suggestion } from '../types/index.js';
import { IAnalyzer } from './analyzer-interface.js';

const logger = createLogger('LayoutAnalyzer');

export interface LayoutAnalysis {
  regions: DifferenceRegion[];
  layoutShifts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    region?: DifferenceRegion;
  }>;
  alignmentIssues: Array<{
    type: string;
    description: string;
    region?: DifferenceRegion;
  }>;
  spacingIssues: Array<{
    type: string;
    description: string;
    region: DifferenceRegion;
  }>;
}

export interface LayoutAnalyzerThresholds {
  minRegionSize: number;
  largeLayoutShiftPercentage: number;
  mediumLayoutShiftPercentage: number;
  highSeverityAreaThreshold: number;
  mediumSeverityAreaThreshold: number;
  edgeAlignmentThreshold: number;
}

/**
 * Handles layout analysis of difference images for visual feedback
 */
export class LayoutAnalyzer implements IAnalyzer<LayoutAnalysis> {
  readonly type = 'layout';

  constructor(private readonly thresholds: LayoutAnalyzerThresholds) {}
  async analyze(diffImagePath: string): Promise<LayoutAnalysis> {
    try {
      logger.debug('Starting layout analysis', { diffImagePath });

      const { data, info } = await sharp(diffImagePath).raw().toBuffer({ resolveWithObject: true });

      const analysis = this.performLayoutAnalysis(data, info);

      logger.debug('Layout analysis completed', {
        diffImagePath,
        regionsCount: analysis.regions.length,
        layoutShiftsCount: analysis.layoutShifts.length,
        alignmentIssuesCount: analysis.alignmentIssues.length
      });

      return analysis;
    } catch (error) {
      logger.error('Layout analysis failed', error as Error, { diffImagePath });
      throw new AnalysisError(
        `Failed to analyze layout for image: ${diffImagePath}`,
        'LAYOUT_ANALYSIS_FAILED',
        error as Error
      );
    }
  }

  private performLayoutAnalysis(
    data: Buffer,
    info: { width: number; height: number; channels: number }
  ): LayoutAnalysis {
    // Detect significant difference regions
    const regions = this.detectSignificantRegions(data, info);

    // Analyze for different types of layout issues
    const layoutShifts = this.detectLayoutShifts(regions, info);
    const alignmentIssues = this.detectAlignmentIssues(regions, info);
    const spacingIssues = this.detectSpacingIssues(regions);

    return {
      regions,
      layoutShifts,
      alignmentIssues,
      spacingIssues
    };
  }

  private detectSignificantRegions(
    data: Buffer,
    info: { width: number; height: number; channels: number }
  ): DifferenceRegion[] {
    const regions: DifferenceRegion[] = [];
    const visited = new Set<string>();
    const minRegionSize = this.thresholds.minRegionSize;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const idx = (info.width * y + x) * info.channels;
        const r = data[idx] || 0;
        const g = data[idx + 1] || 0;
        const b = data[idx + 2] || 0;

        // Check if this pixel indicates a difference (red or yellow from diff image)
        if (this.isDifferencePixel(r, g, b)) {
          const region = this.floodFillRegion(data, info, x, y, visited);

          if (region.width >= minRegionSize && region.height >= minRegionSize) {
            // Determine severity based on size
            const area = region.width * region.height;
            const severity: 'low' | 'medium' | 'high' =
              area > this.thresholds.highSeverityAreaThreshold
                ? 'high'
                : area > this.thresholds.mediumSeverityAreaThreshold
                  ? 'medium'
                  : 'low';

            regions.push({ ...region, severity });
          }
        }
      }
    }

    logger.debug('Significant regions detected', { count: regions.length });
    return regions;
  }

  private isDifferencePixel(r: number, g: number, b: number): boolean {
    // Red pixels (major differences) or yellow pixels (anti-aliasing differences)
    return (r > 200 && g < 100 && b < 100) || (r > 200 && g > 200 && b < 100);
  }

  private floodFillRegion(
    data: Buffer,
    info: { width: number; height: number; channels: number },
    startX: number,
    startY: number,
    visited: Set<string>
  ): DifferenceRegion {
    const stack = [{ x: startX, y: startY }];
    let minX = startX,
      maxX = startX;
    let minY = startY,
      maxY = startY;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= info.width || y < 0 || y >= info.height) {
        continue;
      }

      const idx = (info.width * y + x) * info.channels;
      const r = data[idx] || 0;
      const g = data[idx + 1] || 0;
      const b = data[idx + 2] || 0;

      if (!this.isDifferencePixel(r, g, b)) {
        continue;
      }

      visited.add(key);

      // Update bounds
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Add adjacent pixels to stack
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      severity: 'medium' // Will be updated by caller
    };
  }

  private detectLayoutShifts(
    regions: DifferenceRegion[],
    imageInfo: { width: number; height: number }
  ): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    region?: DifferenceRegion;
  }> {
    const layoutShifts = [];

    for (const region of regions) {
      const area = region.width * region.height;
      const imageArea = imageInfo.width * imageInfo.height;
      const areaPercentage = (area / imageArea) * 100;

      if (areaPercentage > this.thresholds.largeLayoutShiftPercentage) {
        // Large layout change
        layoutShifts.push({
          type: 'major_layout_shift',
          severity: 'high' as const,
          description: `Major layout shift detected (${Math.round(areaPercentage)}% of screen, ${region.width}x${region.height} pixels)`,
          region
        });
      } else if (areaPercentage > this.thresholds.mediumLayoutShiftPercentage) {
        // Medium layout change
        layoutShifts.push({
          type: 'minor_layout_shift',
          severity: 'medium' as const,
          description: `Layout shift detected (${Math.round(areaPercentage)}% of screen, ${region.width}x${region.height} pixels)`,
          region
        });
      }

      // Detect element displacement (tall, narrow regions might indicate moved elements)
      const aspectRatio = region.width / region.height;
      if (aspectRatio < 0.3 || aspectRatio > 3) {
        layoutShifts.push({
          type: 'element_displacement',
          severity: 'medium' as const,
          description: `Element displacement detected (aspect ratio: ${Math.round(aspectRatio * 100) / 100})`,
          region
        });
      }
    }

    logger.debug('Layout shifts detected', { count: layoutShifts.length });
    return layoutShifts;
  }

  private detectAlignmentIssues(
    regions: DifferenceRegion[],
    imageInfo: { width: number; height: number }
  ): Array<{
    type: string;
    description: string;
    region?: DifferenceRegion;
  }> {
    const alignmentIssues = [];
    const edgeThreshold = this.thresholds.edgeAlignmentThreshold;

    for (const region of regions) {
      // Check for alignment issues near edges
      if (region.x < edgeThreshold || region.y < edgeThreshold) {
        alignmentIssues.push({
          type: 'edge_alignment',
          description: 'Element positioning change detected near screen edge',
          region
        });
      }

      if (
        region.x + region.width > imageInfo.width - edgeThreshold ||
        region.y + region.height > imageInfo.height - edgeThreshold
      ) {
        alignmentIssues.push({
          type: 'edge_alignment',
          description: 'Element positioning change detected near screen edge',
          region
        });
      }

      // Check for center alignment issues
      const centerX = imageInfo.width / 2;
      const regionCenterX = region.x + region.width / 2;

      if (Math.abs(regionCenterX - centerX) < 50 && region.width > 100) {
        alignmentIssues.push({
          type: 'center_alignment',
          description: 'Potential center alignment issue detected',
          region
        });
      }

      // Check for grid/column alignment (regions with similar x-coordinates)
      const commonXPositions = regions.filter(
        r => r !== region && Math.abs(r.x - region.x) < 10
      ).length;

      if (commonXPositions > 0) {
        alignmentIssues.push({
          type: 'column_alignment',
          description: 'Column alignment changes detected',
          region
        });
      }
    }

    logger.debug('Alignment issues detected', { count: alignmentIssues.length });
    return alignmentIssues;
  }

  private detectSpacingIssues(regions: DifferenceRegion[]): Array<{
    type: string;
    description: string;
    region: DifferenceRegion;
  }> {
    const spacingIssues = [];

    for (const region of regions) {
      // Small, thin regions might indicate spacing changes
      if ((region.width < 20 && region.height > 50) || (region.height < 20 && region.width > 50)) {
        spacingIssues.push({
          type: 'spacing_adjustment',
          description: `Spacing change detected (${region.width}x${region.height})`,
          region
        });
      }

      // Very small regions might be minor spacing adjustments
      if (region.width < 10 && region.height < 10) {
        spacingIssues.push({
          type: 'minor_spacing',
          description: 'Minor spacing adjustment detected',
          region
        });
      }

      // Check for margin/padding changes (regions at regular intervals)
      const isLikelySpacing = region.width <= 20 || region.height <= 20;
      if (isLikelySpacing) {
        spacingIssues.push({
          type: 'margin_padding',
          description: 'Margin or padding adjustment detected',
          region
        });
      }
    }

    logger.debug('Spacing issues detected', { count: spacingIssues.length });
    return spacingIssues;
  }

  /**
   * Detect issues from layout analysis
   */
  detectIssues(analysis: LayoutAnalysis): Issue[] {
    const issues: Issue[] = [];

    // Add layout shifts as issues
    for (const shift of analysis.layoutShifts) {
      issues.push({
        type: 'layout',
        severity: shift.severity,
        description: shift.description,
        location: shift.region
      });
    }

    // Add alignment issues
    for (const alignment of analysis.alignmentIssues) {
      issues.push({
        type: 'layout',
        severity: 'medium',
        description: alignment.description,
        location: alignment.region
      });
    }

    // Add spacing issues
    for (const spacing of analysis.spacingIssues) {
      issues.push({
        type: 'spacing',
        severity: 'low',
        description: spacing.description,
        location: spacing.region
      });
    }

    return issues;
  }

  /**
   * Generate layout-specific suggestions
   */
  generateSuggestions(issues: Issue[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const layoutIssues = issues.filter(i => i.type === 'layout' || i.type === 'spacing');

    // Group issues by type for better suggestions
    const hasLayoutShifts = layoutIssues.some(i => i.description.includes('layout shift'));
    const hasAlignmentIssues = layoutIssues.some(i => i.description.includes('alignment'));
    const hasSpacingIssues = layoutIssues.some(i => i.type === 'spacing');

    // Layout shift suggestions
    if (hasLayoutShifts) {
      const highSeverity = layoutIssues.some(i => i.severity === 'high');
      suggestions.push({
        type: 'css',
        title: 'Fix Layout Positioning',
        description: 'Adjust element positioning to match the reference design',
        code: `/* Layout positioning fix */\n.target-element {\n  /* Review positioning properties */\n  position: /* check if relative/absolute/fixed is correct */;\n  top: /* adjust vertical position */;\n  left: /* adjust horizontal position */;\n  margin: /* check margin values */;\n  padding: /* check padding values */;\n}`,
        priority: highSeverity ? 1 : 2
      });

      suggestions.push({
        type: 'general',
        title: 'Element Displacement',
        description: 'Check if elements have moved from their expected positions',
        priority: 2
      });
    }

    // Alignment suggestions
    if (hasAlignmentIssues) {
      suggestions.push({
        type: 'general' as const,
        title: 'Layout Alignment',
        description: 'Check element positioning, margins, and padding to ensure proper alignment',
        priority: 2
      });

      suggestions.push({
        type: 'css' as const,
        title: 'Alignment Correction',
        description: 'Fix alignment issues with flexbox or grid',
        code: `/* Alignment correction */\n.container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  /* or use CSS Grid */\n  display: grid;\n  place-items: center;\n}`,
        priority: 2
      });
    }

    // Spacing suggestions
    if (hasSpacingIssues) {
      suggestions.push({
        type: 'css' as const,
        title: 'Spacing Adjustment',
        description: 'Fine-tune margins and padding',
        code: `/* Spacing adjustments */\n.target-element {\n  /* Review and adjust spacing */\n  margin: /* adjust outer spacing */;\n  padding: /* adjust inner spacing */;\n  gap: /* if using flexbox/grid */;\n}`,
        priority: 3
      });
    }

    logger.debug('Layout suggestions generated', { count: suggestions.length });
    return suggestions;
  }
}
