#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Core imports
import { config } from './core/config.js';
import { createLogger } from './core/logger.js';
import { container } from './core/container.js';
import { cleanupManager, browserManager } from './core/resource-manager.js';
import { isVisualMCPError, ValidationError } from './core/errors.js';

// Service imports
import { ScreenshotEngine } from './screenshot/puppeteer.js';
import { ComparisonEngine } from './comparison/differ.js';
import { FeedbackGenerator } from './analysis/feedback-generator.js';
import { MonitoringManager } from './screenshot/monitoring.js';

// Type imports
import { 
  TakeScreenshotParamsSchema,
  CompareVisualsParamsSchema,
  AnalyzeFeedbackParamsSchema,
  StartMonitoringParamsSchema,
  StopMonitoringParamsSchema
} from './types/index.js';

// Interface imports
import { SERVICE_TOKENS } from './interfaces/index.js';

const logger = createLogger('MCPServer');

/**
 * Visual MCP Server with dependency injection and proper resource management
 */
class VisualMCPServer {
  private server: Server;

  constructor() {
    logger.info('Initializing Visual MCP Server', {
      version: '1.0.0',
      nodeVersion: process.version
    });

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

    this.setupDependencies();
    this.setupToolHandlers();
    this.setupErrorHandling();

    logger.info('Visual MCP Server initialized successfully');
  }

  private setupDependencies(): void {
    logger.debug('Setting up dependency injection');

    // Register core services as singletons
    container.registerInstance(SERVICE_TOKENS.BROWSER_MANAGER, browserManager);
    
    container.registerSingleton(SERVICE_TOKENS.SCREENSHOT_ENGINE, () => {
      logger.debug('Creating ScreenshotEngine instance');
      return new ScreenshotEngine(browserManager);
    });

    container.registerSingleton(SERVICE_TOKENS.COMPARISON_ENGINE, () => {
      logger.debug('Creating ComparisonEngine instance');
      return new ComparisonEngine();
    });

    container.registerSingleton(SERVICE_TOKENS.FEEDBACK_ANALYZER, () => {
      logger.debug('Creating FeedbackGenerator instance');
      return new FeedbackGenerator();
    });

    container.registerSingleton(SERVICE_TOKENS.MONITORING_MANAGER, () => {
      logger.debug('Creating MonitoringManager instance');
      const screenshotEngine = container.resolve(SERVICE_TOKENS.SCREENSHOT_ENGINE);
      const comparisonEngine = container.resolve(SERVICE_TOKENS.COMPARISON_ENGINE);
      return new MonitoringManager(screenshotEngine, comparisonEngine);
    });

    logger.debug('Dependency injection setup completed');
  }

  private setupToolHandlers(): void {
    logger.debug('Setting up MCP tool handlers');

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
      const startTime = Date.now();
      logger.info('Tool call received', { 
        tool: request.params.name,
        requestId: request.id
      });

      try {
        switch (request.params.name) {
          case 'take_screenshot':
            return await this.handleTakeScreenshot(request);
          
          case 'compare_visuals':
            return await this.handleCompareVisuals(request);
          
          case 'analyze_ui_feedback':
            return await this.handleAnalyzeFeedback(request);
          
          case 'start_monitoring':
            return await this.handleStartMonitoring(request);
          
          case 'stop_monitoring':
            return await this.handleStopMonitoring(request);
          
          default:
            throw new ValidationError(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Tool call failed', error as Error, { 
          tool: request.params.name,
          requestId: request.id,
          duration
        });

        return this.formatErrorResponse(error);
      } finally {
        const duration = Date.now() - startTime;
        logger.debug('Tool call completed', { 
          tool: request.params.name,
          requestId: request.id,
          duration
        });
      }
    });

    logger.debug('MCP tool handlers setup completed');
  }

  private async handleTakeScreenshot(request: any) {
    const params = TakeScreenshotParamsSchema.parse(request.params.arguments);
    const screenshotEngine = container.resolve(SERVICE_TOKENS.SCREENSHOT_ENGINE);
    
    logger.debug('Taking screenshot', { 
      targetType: params.target.type,
      format: params.options?.format
    });

    const result = await screenshotEngine.takeScreenshot(params.target, params.options);
    
    logger.info('Screenshot taken successfully', { 
      filepath: result.filepath,
      size: result.size,
      dimensions: `${result.width}x${result.height}`
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async handleCompareVisuals(request: any) {
    const params = CompareVisualsParamsSchema.parse(request.params.arguments);
    const comparisonEngine = container.resolve(SERVICE_TOKENS.COMPARISON_ENGINE);
    
    logger.debug('Comparing images', { 
      currentImage: params.currentImage,
      referenceImage: params.referenceImage,
      tolerance: params.options?.tolerance
    });

    const result = await comparisonEngine.compare(
      params.currentImage,
      params.referenceImage,
      params.options
    );
    
    logger.info('Visual comparison completed', { 
      differencePercentage: result.differencePercentage,
      isMatch: result.isMatch,
      regionsCount: result.regions.length
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async handleAnalyzeFeedback(request: any) {
    const params = AnalyzeFeedbackParamsSchema.parse(request.params.arguments);
    const feedbackAnalyzer = container.resolve(SERVICE_TOKENS.FEEDBACK_ANALYZER);
    
    logger.debug('Analyzing feedback', { 
      diffImagePath: params.diffImagePath,
      priority: params.options?.priority,
      suggestionsType: params.options?.suggestionsType
    });

    const result = await feedbackAnalyzer.analyzeDifferences(
      params.diffImagePath,
      params.options
    );
    
    logger.info('Feedback analysis completed', { 
      issuesCount: result.issues.length,
      suggestionsCount: result.suggestions.length,
      confidence: result.confidence
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async handleStartMonitoring(request: any) {
    const params = StartMonitoringParamsSchema.parse(request.params.arguments);
    const monitoringManager = container.resolve(SERVICE_TOKENS.MONITORING_MANAGER);
    
    logger.debug('Starting monitoring', { 
      targetType: params.target.type,
      interval: params.interval,
      autoFeedback: params.autoFeedback
    });

    const sessionId = await monitoringManager.startMonitoring(params);
    
    logger.info('Monitoring started', { 
      sessionId,
      interval: params.interval
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          sessionId, 
          message: 'Monitoring started successfully' 
        }, null, 2)
      }]
    };
  }

  private async handleStopMonitoring(request: any) {
    const params = StopMonitoringParamsSchema.parse(request.params.arguments);
    const monitoringManager = container.resolve(SERVICE_TOKENS.MONITORING_MANAGER);
    
    logger.debug('Stopping monitoring', { sessionId: params.sessionId });

    const summary = await monitoringManager.stopMonitoring(params.sessionId);
    
    logger.info('Monitoring stopped', { 
      sessionId: params.sessionId,
      duration: summary.duration,
      screenshotsCount: summary.totalScreenshots
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(summary, null, 2)
      }]
    };
  }

  private formatErrorResponse(error: unknown) {
    if (isVisualMCPError(error)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: {
              type: error.name,
              code: error.code,
              message: error.message,
              component: error.component,
              timestamp: error.timestamp
            }
          }, null, 2)
        }],
        isError: true
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          error: {
            type: 'UnknownError',
            message: errorMessage
          }
        }, null, 2)
      }],
      isError: true
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error', error);
    };

    // Register cleanup handler for server
    cleanupManager.registerCleanupHandler('MCPServer', async () => {
      logger.info('Shutting down MCP server');
      // Server cleanup would go here if needed
    });
  }

  async run(): Promise<void> {
    try {
      logger.info('Starting Visual MCP Server', {
        config: {
          outputDir: config.outputDir,
          logLevel: config.loggingConfig.level,
          browserHeadless: config.browserConfig.headless
        }
      });

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Visual MCP Server running on stdio');
    } catch (error) {
      logger.error('Failed to start MCP server', error as Error);
      throw error;
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VisualMCPServer();
  
  server.run().catch((error) => {
    logger.error('Fatal server error', error);
    process.exit(1);
  });
}