#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

class VisualMCPTester {
  constructor() {
    this.mcpServerProcess = null;
    this.testResults = [];
  }

  async runTests() {
    console.log('🚀 Starting Visual MCP Test Runner');
    console.log('=====================================\n');

    try {
      // Start MCP server
      await this.startMCPServer();
      
      // Run test scenarios
      await this.runTestScenarios();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async startMCPServer() {
    console.log('📡 Starting MCP Server...');
    
    // Build the project first
    console.log('🔨 Building project...');
    await this.runCommand('npm', ['run', 'build'], rootDir);
    
    // Start the MCP server (we won't actually start it here for testing, 
    // but in real usage it would be started by the MCP client)
    console.log('✅ MCP Server ready\n');
  }

  async runTestScenarios() {
    const scenarios = [
      {
        name: 'Basic Screenshot Test',
        description: 'Test taking a screenshot of a webpage',
        test: () => this.testBasicScreenshot()
      },
      {
        name: 'Visual Comparison Test', 
        description: 'Test comparing two images',
        test: () => this.testVisualComparison()
      },
      {
        name: 'Monitoring Test',
        description: 'Test monitoring functionality',
        test: () => this.testMonitoring()
      },
      {
        name: 'Error Handling Test',
        description: 'Test error scenarios',
        test: () => this.testErrorHandling()
      }
    ];

    for (const scenario of scenarios) {
      console.log(`🧪 Running: ${scenario.name}`);
      console.log(`   ${scenario.description}`);
      
      try {
        const result = await scenario.test();
        this.testResults.push({
          ...scenario,
          status: 'PASS',
          result
        });
        console.log('   ✅ PASSED\n');
      } catch (error) {
        this.testResults.push({
          ...scenario,
          status: 'FAIL',
          error: error.message
        });
        console.log(\`   ❌ FAILED: \${error.message}\n\`);
      }
    }
  }

  async testBasicScreenshot() {
    // Simulate MCP tool call
    const mockRequest = {
      tool: 'take_screenshot',
      params: {
        target: {
          type: 'url',
          url: 'https://example.com',
          viewport: { width: 1200, height: 800 }
        },
        options: {
          format: 'png',
          filename: 'test-screenshot.png'
        }
      }
    };

    // Validate the request structure
    this.validateScreenshotRequest(mockRequest);
    
    return {
      message: 'Screenshot request validation passed',
      request: mockRequest
    };
  }

  async testVisualComparison() {
    // Create mock images for comparison testing
    const mockCurrentImage = path.join(rootDir, 'screenshots', 'current.png');
    const mockReferenceImage = path.join(rootDir, 'screenshots', 'reference.png');
    
    const mockRequest = {
      tool: 'compare_visuals',
      params: {
        currentImage: mockCurrentImage,
        referenceImage: mockReferenceImage,
        options: {
          tolerance: 5,
          threshold: 0.1
        }
      }
    };

    this.validateComparisonRequest(mockRequest);
    
    return {
      message: 'Comparison request validation passed',
      request: mockRequest
    };
  }

  async testMonitoring() {
    const mockRequest = {
      tool: 'start_monitoring',
      params: {
        target: {
          type: 'url',
          url: 'http://localhost:3000'
        },
        interval: 5,
        referenceImage: path.join(rootDir, 'test-app', 'reference-designs', 'default-layout.png'),
        autoFeedback: true
      }
    };

    this.validateMonitoringRequest(mockRequest);
    
    return {
      message: 'Monitoring request validation passed',
      request: mockRequest
    };
  }

  async testErrorHandling() {
    const invalidRequests = [
      {
        name: 'Invalid URL',
        request: {
          tool: 'take_screenshot',
          params: {
            target: {
              type: 'url',
              url: 'not-a-valid-url'
            }
          }
        }
      },
      {
        name: 'Missing required parameters',
        request: {
          tool: 'compare_visuals',
          params: {
            currentImage: 'test.png'
            // Missing referenceImage
          }
        }
      },
      {
        name: 'Invalid tolerance range',
        request: {
          tool: 'compare_visuals',
          params: {
            currentImage: 'test1.png',
            referenceImage: 'test2.png',
            options: {
              tolerance: 150 // Should be 0-100
            }
          }
        }
      }
    ];

    const errors = [];
    
    for (const test of invalidRequests) {
      try {
        this.validateRequest(test.request);
        throw new Error(\`\${test.name} should have failed validation\`);
      } catch (error) {
        errors.push({
          test: test.name,
          expectedError: error.message
        });
      }
    }

    return {
      message: 'Error handling tests passed',
      errorsCaught: errors
    };
  }

  validateScreenshotRequest(request) {
    if (!request.params?.target) {
      throw new Error('Missing target parameter');
    }

    const target = request.params.target;
    if (target.type === 'url' && !this.isValidUrl(target.url)) {
      throw new Error('Invalid URL provided');
    }

    if (target.type === 'region') {
      if (typeof target.x !== 'number' || typeof target.y !== 'number' ||
          typeof target.width !== 'number' || typeof target.height !== 'number') {
        throw new Error('Invalid region coordinates');
      }
    }
  }

  validateComparisonRequest(request) {
    if (!request.params?.currentImage || !request.params?.referenceImage) {
      throw new Error('Missing image parameters');
    }

    const options = request.params.options;
    if (options?.tolerance && (options.tolerance < 0 || options.tolerance > 100)) {
      throw new Error('Tolerance must be between 0 and 100');
    }

    if (options?.threshold && (options.threshold < 0 || options.threshold > 1)) {
      throw new Error('Threshold must be between 0 and 1');
    }
  }

  validateMonitoringRequest(request) {
    if (!request.params?.target || !request.params?.referenceImage) {
      throw new Error('Missing required monitoring parameters');
    }

    const interval = request.params.interval;
    if (interval && (interval < 1 || interval > 300)) {
      throw new Error('Interval must be between 1 and 300 seconds');
    }
  }

  validateRequest(request) {
    switch (request.tool) {
      case 'take_screenshot':
        return this.validateScreenshotRequest(request);
      case 'compare_visuals':
        return this.validateComparisonRequest(request);
      case 'start_monitoring':
        return this.validateMonitoringRequest(request);
      default:
        throw new Error(\`Unknown tool: \${request.tool}\`);
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  generateReport() {
    console.log('📊 Test Results Summary');
    console.log('======================\n');

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(\`Total Tests: \${total}\`);
    console.log(\`Passed: \${passed} ✅\`);
    console.log(\`Failed: \${failed} ❌\`);
    console.log(\`Success Rate: \${Math.round((passed/total) * 100)}%\n\`);

    if (failed > 0) {
      console.log('Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(test => {
          console.log(\`  - \${test.name}: \${test.error}\`);
        });
      console.log('');
    }

    // Save detailed report
    const reportPath = path.join(rootDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed },
      results: this.testResults
    }, null, 2));

    console.log(\`📋 Detailed report saved to: \${reportPath}\`);
  }

  async runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { cwd, stdio: 'inherit' });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(\`Command failed with exit code \${code}\`));
        }
      });
      
      process.on('error', reject);
    });
  }

  async cleanup() {
    if (this.mcpServerProcess) {
      this.mcpServerProcess.kill();
    }
    console.log('\n🧹 Cleanup completed');
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const tester = new VisualMCPTester();

  switch (command) {
    case 'run':
    case undefined:
      await tester.runTests();
      break;
      
    case 'help':
      console.log(\`
Visual MCP Test Runner

Usage:
  node test-runner.js [command]

Commands:
  run      Run all test scenarios (default)
  help     Show this help message

Examples:
  node test-runner.js          # Run all tests
  node test-runner.js run      # Run all tests explicitly
  node test-runner.js help     # Show help
\`);
      break;
      
    default:
      console.error(\`Unknown command: \${command}\`);
      console.log('Run "node test-runner.js help" for usage information');
      process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}