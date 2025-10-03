#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Core imports
import { config } from './core/config.js';
import { createLogger } from './core/logger.js';
import { container } from './core/container.js';
import { cleanupManager } from './core/resource-manager.js';
import { isVisualMCPError, ValidationError } from './core/errors.js';
import { registerCoreServices, initializeCoreServices } from './core/factories.js';

// Interface imports
import {
  SERVICE_TOKENS,
  IScreenshotEngine,
  IComparisonEngine,
  IFeedbackAnalyzer,
  IMonitoringManager
} from './interfaces/index.js';

// Handler imports
import {
  createTakeScreenshotHandler,
  createCompareVisualsHandler,
  createAnalyzeFeedbackHandler,
  createStartMonitoringHandler,
  createStopMonitoringHandler
} from './handlers/index.js';

const logger = createLogger('MCPServer');

/**
 * Visual MCP Server with dependency injection and proper resource management
 */
class VisualMCPServer {
  private server: Server;
  private transport: StdioServerTransport | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private handlersConfigured = false;
  private takeScreenshotHandler?: ReturnType<typeof createTakeScreenshotHandler>;
  private compareVisualsHandler?: ReturnType<typeof createCompareVisualsHandler>;
  private analyzeFeedbackHandler?: ReturnType<typeof createAnalyzeFeedbackHandler>;
  private startMonitoringHandler?: ReturnType<typeof createStartMonitoringHandler>;
  private stopMonitoringHandler?: ReturnType<typeof createStopMonitoringHandler>;

  constructor() {
    logger.info('Initializing Visual MCP Server', {
      version: '1.0.0',
      nodeVersion: process.version
    });

    this.server = new Server(
      {
        name: 'visual-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupErrorHandling();

    logger.info('Visual MCP Server initialized successfully');
  }

  private setupToolHandlers(): void {
    if (this.handlersConfigured) {
      return;
    }

    logger.debug('Setting up MCP tool handlers');

    const screenshotEngine = container.resolve<IScreenshotEngine>(SERVICE_TOKENS.SCREENSHOT_ENGINE);
    const comparisonEngine = container.resolve<IComparisonEngine>(SERVICE_TOKENS.COMPARISON_ENGINE);
    const feedbackAnalyzer = container.resolve<IFeedbackAnalyzer>(SERVICE_TOKENS.FEEDBACK_ANALYZER);
    const monitoringManager = container.resolve<IMonitoringManager>(
      SERVICE_TOKENS.MONITORING_MANAGER
    );

    this.takeScreenshotHandler = createTakeScreenshotHandler(screenshotEngine);
    this.compareVisualsHandler = createCompareVisualsHandler(comparisonEngine);
    this.analyzeFeedbackHandler = createAnalyzeFeedbackHandler(feedbackAnalyzer);
    this.startMonitoringHandler = createStartMonitoringHandler(monitoringManager);
    this.stopMonitoringHandler = createStopMonitoringHandler(monitoringManager);

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
          description:
            'Generate actionable feedback for UI improvements based on visual differences',
          inputSchema: {
            type: 'object',
            properties: {
              diffImagePath: {
                type: 'string',
                description: 'Path to difference visualization image'
              },
              options: {
                type: 'object',
                properties: {
                  priority: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['layout', 'colors', 'typography', 'spacing', 'content']
                    }
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any): Promise<any> => {
      const startTime = Date.now();
      logger.info('Tool call received', {
        tool: request.params.name,
        requestId: request.params._meta?.progressToken
      });

      try {
        switch (request.params.name) {
          case 'take_screenshot':
            return await this.takeScreenshotHandler!(request);

          case 'compare_visuals':
            return await this.compareVisualsHandler!(request);

          case 'analyze_ui_feedback':
            return await this.analyzeFeedbackHandler!(request);

          case 'start_monitoring':
            return await this.startMonitoringHandler!(request);

          case 'stop_monitoring':
            return await this.stopMonitoringHandler!(request);

          default:
            throw new ValidationError(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Tool call failed', error as Error, {
          tool: request.params.name,
          requestId: request.params._meta?.progressToken,
          duration
        });

        return this.formatErrorResponse(error);
      } finally {
        const duration = Date.now() - startTime;
        logger.debug('Tool call completed', {
          tool: request.params.name,
          requestId: request.params._meta?.progressToken,
          duration
        });
      }
    });

    logger.debug('MCP tool handlers setup completed');
    this.handlersConfigured = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        logger.debug('Initializing core services');
        registerCoreServices();
        await initializeCoreServices();
        this.setupToolHandlers();
        this.initialized = true;
      })().finally(() => {
        this.initializationPromise = null;
      });
    }

    await this.initializationPromise;
  }

  private formatErrorResponse(error: unknown) {
    if (isVisualMCPError(error)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: {
                  type: error.name,
                  code: error.code,
                  message: error.message,
                  component: error.component,
                  timestamp: error.timestamp
                }
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                type: 'UnknownError',
                message: errorMessage
              }
            },
            null,
            2
          )
        }
      ],
      isError: true
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = error => {
      logger.error('MCP Server error', error);
    };

    // Register cleanup handler for server
    cleanupManager.removeCleanupHandler('MCPServer');
    cleanupManager.registerCleanupHandler('MCPServer', async () => {
      logger.info('Shutting down MCP server');
      // Server cleanup would go here if needed
    });
  }

  async run(): Promise<{ stop: () => Promise<void> }> {
    try {
      await this.ensureInitialized();

      logger.info('Starting Visual MCP Server', {
        config: {
          outputDir: config.outputDir,
          logLevel: config.loggingConfig.level,
          browserHeadless: config.browserConfig.headless
        }
      });

      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);

      logger.info('Visual MCP Server running on stdio');

      return {
        stop: async () => {
          logger.info('Stopping Visual MCP Server');
          await this.server.close();
          await cleanupManager.cleanup();
          this.transport = null;
        }
      };
    } catch (error) {
      logger.error('Failed to start MCP server', error as Error);
      throw error;
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VisualMCPServer();

  server.run().catch(error => {
    logger.error('Fatal server error', error);
    process.exit(1);
  });
}
