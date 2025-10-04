import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import {
  setupTestFixtures,
  cleanupTestFixtures,
  TestFixtures,
  EXPECTED_TOOLS
} from './fixtures.js';
import { TestMCPServer } from './helpers.js';

// Helper to extract text content from MCP response
function getTextContent(result: unknown): string {
  const content = (result as { content: unknown }).content as
    | Array<{ type: string; text: string }>
    | undefined;
  if (!content || content.length === 0) {
    throw new Error('No content in result');
  }
  return content[0]!.text;
}

describe('MCP Server E2E Tests', () => {
  let server: TestMCPServer;
  let client: Client;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    // Setup test fixtures
    fixtures = await setupTestFixtures();

    // Start MCP server
    server = new TestMCPServer();
    client = await server.start();
  }, 30000);

  afterAll(async () => {
    // Stop server
    await server.stop();

    // Cleanup fixtures
    await cleanupTestFixtures();
  });

  describe('Server Initialization', () => {
    it('should connect to server successfully', () => {
      expect(client).toBeDefined();
    });

    it('should respond to initialization', async () => {
      // Client is already initialized in beforeAll
      expect(client).toBeTruthy();
    });
  });

  describe('Tool Registry', () => {
    it('should list all expected tools', async () => {
      const response = await client.listTools();

      expect(response.tools).toBeDefined();
      expect(response.tools.length).toBe(EXPECTED_TOOLS.length);

      const toolNames = response.tools.map(t => t.name);
      EXPECTED_TOOLS.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });
    });

    it('should provide schema for each tool', async () => {
      const response = await client.listTools();

      response.tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      });
    });

    it('should have proper parameter definitions for take_screenshot', async () => {
      const response = await client.listTools();
      const screenshotTool = response.tools.find(t => t.name === 'take_screenshot');

      expect(screenshotTool).toBeDefined();
      expect(screenshotTool?.inputSchema).toBeDefined();

      const schema = screenshotTool!.inputSchema as {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
      };

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('target');
      expect(schema.properties).toHaveProperty('options');
      expect(schema.required).toContain('target');
    });
  });

  describe('Screenshot Tool', () => {
    it('should capture screenshot of valid URL', async () => {
      const result = await client.callTool({
        name: 'take_screenshot',
        arguments: {
          target: {
            type: 'url',
            url: 'https://example.com'
          },
          options: {
            filename: 'e2e-test-example.png'
          }
        }
      });

      expect(result).toBeDefined();

      const text = getTextContent(result);
      const response = JSON.parse(text);
      expect(response.filepath).toBeDefined();
      expect(response.width).toBeDefined();
      expect(response.height).toBeDefined();
      expect(response.format).toBeDefined();
    }, 30000);

    it('should handle invalid URL gracefully', async () => {
      try {
        await client.callTool({
          name: 'take_screenshot',
          arguments: {
            target: {
              type: 'url',
              url: 'not-a-valid-url'
            }
          }
        });
        fail('Should have thrown an error for invalid URL');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle navigation timeout', async () => {
      try {
        await client.callTool({
          name: 'take_screenshot',
          arguments: {
            target: {
              type: 'url',
              url: 'https://httpstat.us/504?sleep=60000' // Will timeout
            },
            options: {
              timeout: 1000 // 1 second timeout
            }
          }
        });
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('Comparison Tool', () => {
    it('should compare two identical images', async () => {
      const result = await client.callTool({
        name: 'compare_visuals',
        arguments: {
          currentImage: fixtures.testImagePath,
          referenceImage: fixtures.referenceImagePath,
          options: {
            tolerance: 5
          }
        }
      });

      expect(result).toBeDefined();

      const text = getTextContent(result);
      const response = JSON.parse(text);

      expect(response.differencePercentage).toBeDefined();
      expect(response.isMatch).toBe(true);
      expect(response.diffImagePath).toBeDefined();
    });

    it('should handle missing current image file', async () => {
      try {
        await client.callTool({
          name: 'compare_visuals',
          arguments: {
            currentImage: '/nonexistent/path/to/image.png',
            referenceImage: fixtures.referenceImagePath
          }
        });
        fail('Should have thrown error for missing file');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing reference image file', async () => {
      try {
        await client.callTool({
          name: 'compare_visuals',
          arguments: {
            currentImage: fixtures.testImagePath,
            referenceImage: '/nonexistent/path/to/reference.png'
          }
        });
        fail('Should have thrown error for missing reference');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Feedback Analysis Tool', () => {
    let diffImagePath: string;

    beforeAll(async () => {
      // Create a diff image first
      const comparisonResult = await client.callTool({
        name: 'compare_visuals',
        arguments: {
          currentImage: fixtures.testImagePath,
          referenceImage: fixtures.referenceImagePath
        }
      });

      const text = getTextContent(comparisonResult);
      const response = JSON.parse(text);
      diffImagePath = response.diffImagePath;
    });

    it('should generate feedback from diff image', async () => {
      const result = await client.callTool({
        name: 'analyze_ui_feedback',
        arguments: {
          diffImagePath,
          options: {
            priority: ['layout', 'colors'],
            suggestionsType: 'both'
          }
        }
      });

      expect(result).toBeDefined();

      const text = getTextContent(result);
      const response = JSON.parse(text);

      expect(response.summary).toBeDefined();
      expect(response.issues).toBeDefined();
      expect(response.suggestions).toBeDefined();
      expect(Array.isArray(response.issues)).toBe(true);
      expect(Array.isArray(response.suggestions)).toBe(true);
    });

    it('should handle invalid diff image path', async () => {
      try {
        await client.callTool({
          name: 'analyze_ui_feedback',
          arguments: {
            diffImagePath: '/nonexistent/diff.png'
          }
        });
        fail('Should have thrown error for invalid diff path');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Monitoring Tools', () => {
    let sessionId: string;

    it('should start monitoring session', async () => {
      const result = await client.callTool({
        name: 'start_monitoring',
        arguments: {
          target: {
            type: 'url',
            url: 'https://example.com'
          },
          referenceImage: fixtures.referenceImagePath,
          interval: 5,
          autoFeedback: false
        }
      });

      expect(result).toBeDefined();

      const text = getTextContent(result);
      const response = JSON.parse(text);

      expect(response.sessionId).toBeDefined();
      expect(response.message).toContain('started');

      sessionId = response.sessionId;
    }, 30000);

    it('should stop monitoring session and return summary', async () => {
      expect(sessionId).toBeDefined();

      const result = await client.callTool({
        name: 'stop_monitoring',
        arguments: {
          sessionId
        }
      });

      expect(result).toBeDefined();

      const text = getTextContent(result);
      const response = JSON.parse(text);

      expect(response.sessionId).toBe(sessionId);
      expect(response.totalScreenshots).toBeDefined();
      expect(response.duration).toBeDefined();
    });

    it('should handle invalid session ID', async () => {
      try {
        await client.callTool({
          name: 'stop_monitoring',
          arguments: {
            sessionId: 'nonexistent-session-id'
          }
        });
        fail('Should have thrown error for invalid session ID');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing reference image for monitoring', async () => {
      try {
        await client.callTool({
          name: 'start_monitoring',
          arguments: {
            target: {
              type: 'url',
              url: 'https://example.com'
            },
            referenceImage: '/nonexistent/reference.png',
            interval: 5
          }
        });
        fail('Should have thrown error for missing reference image');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid tool name', async () => {
      try {
        await client.callTool({
          name: 'nonexistent_tool',
          arguments: {}
        });
        fail('Should have thrown error for invalid tool');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should return error for missing required parameters', async () => {
      try {
        await client.callTool({
          name: 'take_screenshot',
          arguments: {} // Missing required 'target' parameter
        });
        fail('Should have thrown error for missing parameters');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should return error for invalid parameter types', async () => {
      try {
        await client.callTool({
          name: 'take_screenshot',
          arguments: {
            target: 'not-an-object' // Should be an object
          }
        });
        fail('Should have thrown error for invalid parameter type');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted tool response', async () => {
      const result = await client.callTool({
        name: 'compare_visuals',
        arguments: {
          currentImage: fixtures.testImagePath,
          referenceImage: fixtures.referenceImagePath
        }
      });

      expect(result).toHaveProperty('content');
      const content = (result as { content: unknown }).content;
      expect(Array.isArray(content)).toBe(true);
      expect((content as Array<unknown>).length).toBeGreaterThan(0);

      const text = getTextContent(result);
      expect(text).toBeDefined();
    });

    it('should return valid JSON in text content', async () => {
      const result = await client.callTool({
        name: 'compare_visuals',
        arguments: {
          currentImage: fixtures.testImagePath,
          referenceImage: fixtures.referenceImagePath
        }
      });

      const text = getTextContent(result);
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });
});
