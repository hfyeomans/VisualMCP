import fs from 'fs-extra';
import sharp from 'sharp';
import { 
  FeedbackOptions, 
  FeedbackResult, 
  Issue, 
  Suggestion,
  DifferenceRegion 
} from '../types/index.js';

interface ColorAnalysis {
  dominantColors: Array<{ color: string; percentage: number }>;
  contrast: number;
  brightness: number;
}

interface LayoutAnalysis {
  regions: DifferenceRegion[];
  layoutShifts: Array<{ type: string; severity: string; description: string }>;
  alignmentIssues: Array<{ type: string; description: string }>;
}

export class FeedbackAnalyzer {
  constructor() {}

  async analyzeDifferences(
    diffImagePath: string, 
    options: FeedbackOptions = {}
  ): Promise<FeedbackResult> {
    if (!await fs.pathExists(diffImagePath)) {
      throw new Error(`Diff image not found: ${diffImagePath}`);
    }

    const priorities = options.priority || ['layout'];
    const context = options.context || '';
    
    // Analyze the diff image
    const imageAnalysis = await this.analyzeImage(diffImagePath);
    const colorAnalysis = await this.analyzeColors(diffImagePath);
    const layoutAnalysis = await this.analyzeLayout(diffImagePath);
    
    // Generate issues and suggestions based on analysis
    const issues = await this.generateIssues(imageAnalysis, colorAnalysis, layoutAnalysis, priorities);
    const suggestions = await this.generateSuggestions(issues, priorities, options.suggestionsType || 'both');
    
    // Calculate overall confidence
    const confidence = this.calculateConfidence(issues, imageAnalysis);
    
    // Generate summary
    const summary = this.generateSummary(issues, suggestions, context);

    return {
      summary,
      issues,
      suggestions,
      priority: priorities.join(', '),
      confidence
    };
  }

  private async analyzeImage(imagePath: string): Promise<{ width: number; height: number; channels: number }> {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      channels: metadata.channels || 3
    };
  }

  private async analyzeColors(imagePath: string): Promise<ColorAnalysis> {
    try {
      const { data, info } = await sharp(imagePath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colorCounts = new Map<string, number>();
      let totalPixels = 0;
      let totalBrightness = 0;
      const redPixels = [];
      const yellowPixels = [];

      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i] || 0;
        const g = data[i + 1] || 0;
        const b = data[i + 2] || 0;

        // Track red pixels (differences)
        if (r > 200 && g < 100 && b < 100) {
          redPixels.push({ r, g, b });
        }
        
        // Track yellow pixels (AA differences)
        if (r > 200 && g > 200 && b < 100) {
          yellowPixels.push({ r, g, b });
        }

        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        totalPixels++;

        // Group similar colors
        const colorKey = `${Math.floor(r / 32)},${Math.floor(g / 32)},${Math.floor(b / 32)}`;
        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
      }

      // Find dominant colors
      const sortedColors = Array.from(colorCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([key, count]) => {
          const parts = key.split(',').map(n => parseInt(n || '0'));
          const r = (parts[0] || 0) * 32;
          const g = (parts[1] || 0) * 32;
          const b = (parts[2] || 0) * 32;
          return {
            color: `rgb(${r}, ${g}, ${b})`,
            percentage: Math.round((count / totalPixels) * 100)
          };
        });

      const averageBrightness = totalBrightness / totalPixels;
      
      return {
        dominantColors: sortedColors,
        contrast: this.calculateContrast(data, info.channels),
        brightness: averageBrightness
      };
    } catch (error) {
      console.error('Error analyzing colors:', error);
      return {
        dominantColors: [],
        contrast: 0,
        brightness: 0
      };
    }
  }

  private calculateContrast(data: Buffer, channels: number): number {
    let minBrightness = 255;
    let maxBrightness = 0;

    for (let i = 0; i < data.length; i += channels) {
      const brightness = ((data[i] || 0) + (data[i + 1] || 0) + (data[i + 2] || 0)) / 3;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    return maxBrightness - minBrightness;
  }

  private async analyzeLayout(imagePath: string): Promise<LayoutAnalysis> {
    // This is a simplified layout analysis
    // In a real implementation, you might use computer vision libraries
    // or machine learning models to detect UI elements
    
    const regions: DifferenceRegion[] = [];
    const layoutShifts = [];
    const alignmentIssues = [];

    try {
      const { data, info } = await sharp(imagePath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Detect large continuous red/yellow regions (potential layout shifts)
      const significantRegions = this.detectSignificantRegions(data, info);
      
      for (const region of significantRegions) {
        regions.push(region);
        
        // Classify the type of layout issue
        if (region.width > info.width * 0.3 || region.height > info.height * 0.3) {
          layoutShifts.push({
            type: 'major_layout_shift',
            severity: 'high',
            description: `Large layout change detected (${region.width}x${region.height} pixels)`
          });
        } else if (region.width > info.width * 0.1 || region.height > info.height * 0.1) {
          layoutShifts.push({
            type: 'minor_layout_shift',
            severity: 'medium',
            description: `Medium layout change detected (${region.width}x${region.height} pixels)`
          });
        }

        // Check for alignment issues (regions near edges might indicate alignment problems)
        if (region.x < 20 || region.y < 20 || 
            region.x + region.width > info.width - 20 || 
            region.y + region.height > info.height - 20) {
          alignmentIssues.push({
            type: 'edge_alignment',
            description: 'Element positioning change detected near screen edge'
          });
        }
      }

    } catch (error) {
      console.error('Error analyzing layout:', error);
    }

    return {
      regions,
      layoutShifts,
      alignmentIssues
    };
  }

  private detectSignificantRegions(data: Buffer, info: { width: number; height: number; channels: number }): DifferenceRegion[] {
    const regions: DifferenceRegion[] = [];
    const visited = new Set<string>();
    
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const idx = (info.width * y + x) * info.channels;
        const r = data[idx] || 0;
        const g = data[idx + 1] || 0;
        const b = data[idx + 2] || 0;
        
        // Check if this pixel indicates a difference
        if ((r > 200 && g < 100 && b < 100) || (r > 200 && g > 200 && b < 100)) {
          const region = this.floodFillRegion(data, info, x, y, visited);
          if (region.width > 5 && region.height > 5) {
            regions.push(region);
          }
        }
      }
    }
    
    return regions;
  }

  private floodFillRegion(
    data: Buffer, 
    info: { width: number; height: number; channels: number }, 
    startX: number, 
    startY: number, 
    visited: Set<string>
  ): DifferenceRegion {
    const stack = [{ x: startX, y: startY }];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    
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
      
      if (!((r > 200 && g < 100 && b < 100) || (r > 200 && g > 200 && b < 100))) {
        continue;
      }
      
      visited.add(key);
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
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
      severity: 'medium'
    };
  }

  private async generateIssues(
    _imageAnalysis: { width: number; height: number; channels: number },
    colorAnalysis: ColorAnalysis,
    layoutAnalysis: LayoutAnalysis,
    priorities: string[]
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Layout issues
    if (priorities.includes('layout')) {
      for (const shift of layoutAnalysis.layoutShifts) {
        issues.push({
          type: 'layout',
          severity: shift.severity as 'low' | 'medium' | 'high' | 'critical',
          description: shift.description
        });
      }

      for (const alignment of layoutAnalysis.alignmentIssues) {
        issues.push({
          type: 'layout',
          severity: 'medium',
          description: alignment.description
        });
      }
    }

    // Color issues
    if (priorities.includes('colors')) {
      if (colorAnalysis.contrast < 50) {
        issues.push({
          type: 'colors',
          severity: 'low',
          description: 'Low color contrast detected in differences'
        });
      }

      // Check for significant color differences
      const redDifference = colorAnalysis.dominantColors.find(c => c.color.includes('255, 0, 0'));
      if (redDifference && redDifference.percentage > 10) {
        issues.push({
          type: 'colors',
          severity: 'high',
          description: `Significant color differences detected (${redDifference.percentage}% of image)`
        });
      }
    }

    // Typography issues (simplified)
    if (priorities.includes('typography')) {
      for (const region of layoutAnalysis.regions) {
        if (region.height < 20 && region.width > 100) {
          issues.push({
            type: 'typography',
            severity: 'medium',
            description: 'Potential text rendering differences detected',
            location: region
          });
        }
      }
    }

    // Spacing issues
    if (priorities.includes('spacing')) {
      for (const region of layoutAnalysis.regions) {
        if (region.width < 10 || region.height < 10) {
          issues.push({
            type: 'spacing',
            severity: 'low',
            description: 'Minor spacing adjustment detected',
            location: region
          });
        }
      }
    }

    return issues;
  }

  private async generateSuggestions(
    issues: Issue[],
    _priorities: string[],
    suggestionsType: 'css' | 'general' | 'both'
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'layout':
          if (suggestionsType === 'css' || suggestionsType === 'both') {
            suggestions.push({
              type: 'css',
              title: 'Fix Layout Positioning',
              description: 'Adjust element positioning to match the reference design',
              code: this.generateLayoutCSS(issue),
              priority: issue.severity === 'high' ? 1 : issue.severity === 'medium' ? 2 : 3
            });
          }
          if (suggestionsType === 'general' || suggestionsType === 'both') {
            suggestions.push({
              type: 'general',
              title: 'Layout Alignment Issue',
              description: 'Check element positioning, margins, and padding to ensure proper alignment',
              priority: issue.severity === 'high' ? 1 : 2
            });
          }
          break;

        case 'colors':
          if (suggestionsType === 'css' || suggestionsType === 'both') {
            suggestions.push({
              type: 'css',
              title: 'Color Correction',
              description: 'Update colors to match the reference design',
              code: this.generateColorCSS(issue),
              priority: 2
            });
          }
          break;

        case 'typography':
          if (suggestionsType === 'css' || suggestionsType === 'both') {
            suggestions.push({
              type: 'css',
              title: 'Typography Adjustment',
              description: 'Adjust font properties to match the reference',
              code: this.generateTypographyCSS(issue),
              priority: 2
            });
          }
          break;

        case 'spacing':
          if (suggestionsType === 'css' || suggestionsType === 'both') {
            suggestions.push({
              type: 'css',
              title: 'Spacing Adjustment',
              description: 'Fine-tune margins and padding',
              code: this.generateSpacingCSS(issue),
              priority: 3
            });
          }
          break;
      }
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  private generateLayoutCSS(_issue: Issue): string {
    
    return `/* Adjust positioning for layout fix */
.target-element {
  position: relative;
  /* Review and adjust positioning based on difference analysis */
  /* Consider using margin/padding adjustments */
}`;
  }

  private generateColorCSS(_issue: Issue): string {
    return `/* Color correction based on difference analysis */
.target-element {
  /* Review and adjust these color properties: */
  background-color: /* update to match reference */;
  color: /* update text color if needed */;
  border-color: /* update border color if applicable */;
}`;
  }

  private generateTypographyCSS(_issue: Issue): string {
    return `/* Typography adjustments */
.target-element {
  font-family: /* check font family matches */;
  font-size: /* verify font size */;
  font-weight: /* check font weight */;
  line-height: /* adjust line height if needed */;
  letter-spacing: /* fine-tune letter spacing */;
}`;
  }

  private generateSpacingCSS(_issue: Issue): string {
    
    // const spacing = Math.max(1, Math.round(_issue.location?.width || 10) / 10);
    return `/* Spacing adjustments */
.target-element {
  /* Review and adjust spacing based on difference analysis */
  margin: /* adjust as needed */;
  padding: /* adjust as needed */;
}`;
  }

  private calculateConfidence(issues: Issue[], imageAnalysis: { width: number; height: number }): number {
    if (issues.length === 0) return 100;

    let confidenceScore = 100;
    
    // Reduce confidence based on number of issues
    confidenceScore -= Math.min(issues.length * 5, 30);
    
    // Reduce confidence more for critical/high severity issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          confidenceScore -= 20;
          break;
        case 'high':
          confidenceScore -= 15;
          break;
        case 'medium':
          confidenceScore -= 10;
          break;
        case 'low':
          confidenceScore -= 5;
          break;
      }
    }

    // Factor in image size (larger images might have more nuanced differences)
    const imageArea = imageAnalysis.width * imageAnalysis.height;
    if (imageArea > 1000000) { // Large images
      confidenceScore -= 5;
    }

    return Math.max(10, Math.min(100, confidenceScore));
  }

  private generateSummary(issues: Issue[], suggestions: Suggestion[], context: string): string {
    if (issues.length === 0) {
      return 'No significant visual differences detected. The current implementation closely matches the reference design.';
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;

    let summary = `Analysis detected ${issues.length} visual difference${issues.length > 1 ? 's' : ''}. Low issues: ${lowIssues}.`.replace(' Low issues: 0.', '.');

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