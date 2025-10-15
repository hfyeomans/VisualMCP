import { z } from 'zod';

// Screenshot target types
// Note: 'window' target type removed as it's not currently implemented
// Desktop window capture requires platform-specific implementation
export const ScreenshotTargetSchema = z.union([
  z.object({
    type: z.literal('url'),
    url: z.string().url(),
    viewport: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive()
      })
      .optional()
  }),
  z.object({
    type: z.literal('region'),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
]);

export type ScreenshotTarget = z.infer<typeof ScreenshotTargetSchema>;

// Screenshot options
export const ScreenshotOptionsSchema = z.object({
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().int().min(1).max(100).optional(),
  filename: z.string().optional(),
  fullPage: z.boolean().default(false),
  timeout: z.number().int().positive().optional(),
  waitForNetworkIdle: z.boolean().optional(),
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    })
    .optional()
});

export type ScreenshotOptions = Partial<z.infer<typeof ScreenshotOptionsSchema>>;

// Screenshot result
export interface ScreenshotResult {
  filepath: string;
  width: number;
  height: number;
  format: string;
  size: number;
  timestamp: string;
  target: ScreenshotTarget;
}

// Comparison options
export const ComparisonOptionsSchema = z.object({
  tolerance: z.number().min(0).max(100).default(5),
  ignoreRegions: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      })
    )
    .default([]),
  includeAA: z.boolean().default(true),
  threshold: z.number().min(0).max(1).default(0.1)
});

export type ComparisonOptions = Partial<z.infer<typeof ComparisonOptionsSchema>>;

// Comparison result
export interface ComparisonResult {
  differencePercentage: number;
  pixelsDifferent: number;
  totalPixels: number;
  diffImagePath: string;
  isMatch: boolean;
  regions: DifferenceRegion[];
  metadata: {
    currentImage: ImageMetadata;
    referenceImage: ImageMetadata;
    comparison: ComparisonOptions;
  };
}

export interface DifferenceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  severity: 'low' | 'medium' | 'high';
}

export interface ImageMetadata {
  path: string;
  width: number;
  height: number;
  format: string;
  size: number;
  timestamp: string;
}

// Feedback analysis
export const FeedbackOptionsSchema = z.object({
  priority: z
    .array(z.enum(['layout', 'colors', 'typography', 'spacing', 'content']))
    .default(['layout']),
  context: z.string().optional(),
  suggestionsType: z.enum(['css', 'general', 'both']).default('both')
});

export type FeedbackOptions = Partial<z.infer<typeof FeedbackOptionsSchema>>;

export interface FeedbackResult {
  summary: string;
  issues: Issue[];
  suggestions: Suggestion[];
  priority: string;
  confidence: number;
}

export interface Issue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Suggestion {
  type: 'css' | 'general';
  title: string;
  description: string;
  code?: string;
  priority: number;
}

// Monitoring session
export interface MonitoringSession {
  id: string;
  target: ScreenshotTarget;
  interval: number;
  referenceImagePath: string;
  startTime: string;
  isActive: boolean;
  autoFeedback: boolean;
  screenshots: MonitoringScreenshot[];
}

export interface MonitoringScreenshot {
  filepath: string;
  timestamp: string;
  differencePercentage?: number;
  hasSignificantChange: boolean;
}

// MCP Tool parameter schemas
export const TakeScreenshotParamsSchema = z.object({
  target: ScreenshotTargetSchema,
  options: ScreenshotOptionsSchema.optional()
});

export const CompareVisualsParamsSchema = z.object({
  currentImage: z.string(),
  referenceImage: z.string(),
  options: ComparisonOptionsSchema.optional()
});

export const AnalyzeFeedbackParamsSchema = z.object({
  diffImagePath: z.string(),
  options: FeedbackOptionsSchema.optional()
});

export const StartMonitoringParamsSchema = z.object({
  target: ScreenshotTargetSchema,
  interval: z.number().int().min(1).max(300).default(5),
  referenceImage: z.string(),
  autoFeedback: z.boolean().default(true)
});

export const StopMonitoringParamsSchema = z.object({
  sessionId: z.string()
});

export type TakeScreenshotParams = z.infer<typeof TakeScreenshotParamsSchema>;
export type CompareVisualsParams = z.infer<typeof CompareVisualsParamsSchema>;
export type AnalyzeFeedbackParams = z.infer<typeof AnalyzeFeedbackParamsSchema>;
export type StartMonitoringParams = z.infer<typeof StartMonitoringParamsSchema>;
export type StopMonitoringParams = z.infer<typeof StopMonitoringParamsSchema>;

// MCP Request/Response types
export interface MCPToolRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
    _meta?: unknown;
  };
  method: string;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  _meta?: unknown;
}

export type MCPToolHandler = (request: MCPToolRequest) => Promise<MCPToolResponse>;

// Monitoring response types
export interface MonitoringStartResponse {
  sessionId: string;
  message: string;
}

export interface MonitoringSummary {
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: string;
  totalScreenshots: number;
  significantChanges: number;
  averageDifference: number;
  screenshots: MonitoringScreenshot[];
  target: ScreenshotTarget;
}

// Native desktop capture types (Phase 6)
export * from './native-capture.js';
