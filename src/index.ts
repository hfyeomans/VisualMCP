#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// z is imported for future schema validation
// import { z } from 'zod';
import { 
  TakeScreenshotParamsSchema,
  CompareVisualsParamsSchema,
  AnalyzeFeedbackParamsSchema,
  StartMonitoringParamsSchema,
  StopMonitoringParamsSchema
} from './types/index.js';
import { ScreenshotEngine } from './screenshot/puppeteer.js';
import { ComparisonEngine } from './comparison/differ.js';
import { FeedbackAnalyzer } from './comparison/analyzer.js';
import { MonitoringManager } from './screenshot/monitoring.js';

class VisualMCPServer {
  private server: Server;
  private screenshotEngine: ScreenshotEngine;
  private comparisonEngine: ComparisonEngine;
  private feedbackAnalyzer: FeedbackAnalyzer;
  private monitoringManager: MonitoringManager;

  constructor() {
    this.server = new Server(
      {
        name: 'visual-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.screenshotEngine = new ScreenshotEngine();
    this.comparisonEngine = new ComparisonEngine();
    this.feedbackAnalyzer = new FeedbackAnalyzer();
    this.monitoringManager = new MonitoringManager(this.screenshotEngine, this.comparisonEngine);

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'take_screenshot',
          description: 'Capture a screenshot of a web page, window, or screen region',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                description: 'Screenshot target specification',
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['url'] },
                      url: { type: 'string', format: 'uri' },
                      viewport: {
                        type: 'object',
                        properties: {
                          width: { type: 'integer', minimum: 1 },
                          height: { type: 'integer', minimum: 1 }
                        },
                        additionalProperties: false
                      }
                    },
                    required: ['type', 'url'],
                    additionalProperties: false
                  },
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['region'] },
                      x: { type: 'integer', minimum: 0 },
                      y: { type: 'integer', minimum: 0 },
                      width: { type: 'integer', minimum: 1 },
                      height: { type: 'integer', minimum: 1 }
                    },
                    required: ['type', 'x', 'y', 'width', 'height'],
                    additionalProperties: false
                  }
                ]
              },
              options: {
                type: 'object',
                properties: {
                  format: { type: 'string', enum: ['png', 'jpeg'] },
                  quality: { type: 'integer', minimum: 1, maximum: 100 },
                  filename: { type: 'string' },
                  fullPage: { type: 'boolean' }
                },
                additionalProperties: false
              }
            },
            required: ['target'],
            additionalProperties: false
          }
        },
        {
          name: 'compare_visuals',
          description: 'Compare two images and detect visual differences',
          inputSchema: {
            type: 'object',
            properties: {
              currentImage: { type: 'string', description: 'Path to current image' },
              referenceImage: { type: 'string', description: 'Path to reference image' },
              options: {
                type: 'object',
                properties: {
                  tolerance: { type: 'number', minimum: 0, maximum: 100 },
                  threshold: { type: 'number', minimum: 0, maximum: 1 },
                  includeAA: { type: 'boolean' }
                },
                additionalProperties: false
              }
            },
            required: ['currentImage', 'referenceImage'],
            additionalProperties: false
          }
        },
        {
          name: 'analyze_ui_feedback',
          description: 'Generate actionable feedback for UI improvements based on visual differences',
          inputSchema: {
            type: 'object',
            properties: {
              diffImagePath: { type: 'string', description: 'Path to difference visualization image' },
              options: {
                type: 'object',
                properties: {
                  priority: { 
                    type: 'array',
                    items: { type: 'string', enum: ['layout', 'colors', 'typography', 'spacing', 'content'] }
                  },
                  context: { type: 'string' },
                  suggestionsType: { type: 'string', enum: ['css', 'general', 'both'] }
                },
                additionalProperties: false
              }
            },
            required: ['diffImagePath'],
            additionalProperties: false
          }
        },
        {
          name: 'start_monitoring',
          description: 'Begin incremental screenshot monitoring of a target',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                description: 'Target to monitor (same as take_screenshot target)'
              },
              interval: { type: 'integer', minimum: 1, maximum: 300 },
              referenceImage: { type: 'string' },
              autoFeedback: { type: 'boolean' }
            },
            required: ['target', 'referenceImage'],
            additionalProperties: false
          }
        },
        {
          name: 'stop_monitoring',
          description: 'Stop a monitoring session and get summary',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' }
            },
            required: ['sessionId'],
            additionalProperties: false
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'take_screenshot': {
            const params = TakeScreenshotParamsSchema.parse(request.params.arguments);
            const result = await this.screenshotEngine.takeScreenshot(params.target, params.options);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'compare_visuals': {
            const params = CompareVisualsParamsSchema.parse(request.params.arguments);
            const result = await this.comparisonEngine.compare(
              params.currentImage,
              params.referenceImage,
              params.options
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'analyze_ui_feedback': {
            const params = AnalyzeFeedbackParamsSchema.parse(request.params.arguments);
            const result = await this.feedbackAnalyzer.analyzeDifferences(
              params.diffImagePath,
              params.options
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'start_monitoring': {
            const params = StartMonitoringParamsSchema.parse(request.params.arguments);
            const sessionId = await this.monitoringManager.startMonitoring(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ sessionId, message: 'Monitoring started successfully' }, null, 2)
                }
              ]
            };
          }

          case 'stop_monitoring': {
            const params = StopMonitoringParamsSchema.parse(request.params.arguments);
            const summary = await this.monitoringManager.stopMonitoring(params.sessionId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(summary, null, 2)
                }
              ]
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2)
            }
          ],
          isError: true
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup() {
    try {
      await this.monitoringManager.cleanup();
      await this.screenshotEngine.cleanup();
      console.error('Visual MCP Server shut down gracefully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Visual MCP Server running on stdio');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VisualMCPServer();
  server.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}