#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

class VisualMCPDemo {
  constructor() {
    this.mcpProcess = null;
    this.testAppProcess = null;
  }

  async runDemo() {
    console.log('🎯 Visual MCP Interactive Demo');
    console.log('==============================\n');

    try {
      await this.setup();
      await this.runDemoScenarios();
    } catch (error) {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async setup() {
    console.log('🔧 Setting up demo environment...\n');
    
    // Ensure directories exist
    await fs.ensureDir(path.join(rootDir, 'screenshots'));
    await fs.ensureDir(path.join(rootDir, 'comparisons'));
    
    // Build the MCP server
    console.log('🔨 Building MCP server...');
    await this.runCommand('npm', ['run', 'build'], rootDir);
    console.log('✅ MCP server built\n');
  }

  async runDemoScenarios() {
    const scenarios = [
      {
        title: 'Scenario 1: Basic Screenshot Capture',
        description: 'Demonstrate taking screenshots of web pages',
        action: () => this.demoBasicScreenshot()
      },
      {
        title: 'Scenario 2: Visual Comparison',
        description: 'Show how to compare images and detect differences',
        action: () => this.demoVisualComparison()
      },
      {
        title: 'Scenario 3: Real-time Monitoring',
        description: 'Monitor a webpage for changes over time',
        action: () => this.demoMonitoring()
      },
      {
        title: 'Scenario 4: UI Feedback Generation',
        description: 'Generate actionable feedback from visual differences',
        action: () => this.demoFeedbackGeneration()
      },
      {
        title: 'Scenario 5: Test App Integration',
        description: 'Use with the included test application',
        action: () => this.demoTestAppIntegration()
      }
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      console.log(\`\n📋 \${scenario.title}\`);
      console.log(\`   \${scenario.description}\`);
      console.log('   ' + '='.repeat(50));
      
      if (i > 0) {
        console.log('   Press Enter to continue...');
        await this.waitForKeyPress();
      }
      
      await scenario.action();
      
      if (i < scenarios.length - 1) {
        console.log('   ✅ Scenario completed. Press Enter for next scenario...');
        await this.waitForKeyPress();
      }
    }
  }

  async demoBasicScreenshot() {
    console.log('   🖼️  Taking screenshot of example.com...');
    
    const mcpRequest = {
      method: 'tools/call',
      params: {
        name: 'take_screenshot',
        arguments: {
          target: {
            type: 'url',
            url: 'https://example.com',
            viewport: { width: 1200, height: 800 }
          },
          options: {
            format: 'png',
            filename: 'example-demo.png'
          }
        }
      }
    };

    console.log('   📤 MCP Request:', JSON.stringify(mcpRequest, null, 4));
    
    // Simulate the response
    const mockResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          filepath: '/path/to/screenshots/example-demo.png',
          width: 1200,
          height: 800,
          format: 'png',
          size: 245760,
          timestamp: new Date().toISOString(),
          target: mcpRequest.params.arguments.target
        }, null, 2)
      }]
    };

    await this.delay(1000);
    console.log('   📥 MCP Response:', JSON.stringify(mockResponse, null, 4));
    console.log('   ✨ Screenshot would be saved to screenshots/example-demo.png');
  }

  async demoVisualComparison() {
    console.log('   🔍 Comparing two images...');
    
    const mcpRequest = {
      method: 'tools/call',
      params: {
        name: 'compare_visuals',
        arguments: {
          currentImage: '/path/to/screenshots/current.png',
          referenceImage: '/path/to/references/expected.png',
          options: {
            tolerance: 5,
            threshold: 0.1,
            ignoreRegions: [
              { x: 0, y: 0, width: 100, height: 50 } // Ignore header area
            ]
          }
        }
      }
    };

    console.log('   📤 MCP Request:', JSON.stringify(mcpRequest, null, 4));
    
    const mockResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          differencePercentage: 3.42,
          pixelsDifferent: 32768,
          totalPixels: 960000,
          diffImagePath: '/path/to/comparisons/diff_12345.png',
          isMatch: true,
          regions: [
            {
              x: 150,
              y: 200,
              width: 300,
              height: 100,
              severity: 'medium'
            }
          ],
          metadata: {
            currentImage: {
              path: '/path/to/screenshots/current.png',
              width: 1200,
              height: 800,
              format: 'png',
              size: 245760,
              timestamp: new Date().toISOString()
            },
            referenceImage: {
              path: '/path/to/references/expected.png', 
              width: 1200,
              height: 800,
              format: 'png',
              size: 248832,
              timestamp: new Date(Date.now() - 86400000).toISOString()
            },
            comparison: mcpRequest.params.arguments.options
          }
        }, null, 2)
      }]
    };

    await this.delay(2000);
    console.log('   📥 MCP Response:', JSON.stringify(mockResponse, null, 4));
    console.log('   ✨ 3.42% difference found, within tolerance (5%)');
    console.log('   💾 Difference visualization saved to comparisons/diff_12345.png');
  }

  async demoMonitoring() {
    console.log('   👁️  Starting monitoring session...');
    
    const startRequest = {
      method: 'tools/call',
      params: {
        name: 'start_monitoring',
        arguments: {
          target: {
            type: 'url',
            url: 'http://localhost:3000'
          },
          interval: 5,
          referenceImage: '/path/to/references/baseline.png',
          autoFeedback: true
        }
      }
    };

    console.log('   📤 Start Monitoring Request:', JSON.stringify(startRequest, null, 4));
    
    const sessionId = 'monitor_' + Math.random().toString(36).substr(2, 9);
    const startResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sessionId,
          message: 'Monitoring started successfully'
        }, null, 2)
      }]
    };

    await this.delay(1000);
    console.log('   📥 Start Response:', JSON.stringify(startResponse, null, 4));
    console.log(\`   🔄 Monitoring session \${sessionId} is now active...\`);
    
    // Simulate monitoring for a few iterations
    for (let i = 1; i <= 3; i++) {
      await this.delay(2000);
      console.log(\`   📸 Screenshot \${i}/3 taken (${new Date().toLocaleTimeString()})\`);
      
      if (i === 2) {
        console.log('   🚨 Significant change detected (4.2% difference)!');
      } else {
        console.log('   ✅ No significant changes (0.8% difference)');
      }
    }
    
    // Stop monitoring
    console.log('   🛑 Stopping monitoring...');
    const stopRequest = {
      method: 'tools/call',
      params: {
        name: 'stop_monitoring',
        arguments: {
          sessionId
        }
      }
    };

    const stopResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sessionId,
          startTime: new Date(Date.now() - 15000).toISOString(),
          endTime: new Date().toISOString(),
          duration: '15s',
          totalScreenshots: 3,
          significantChanges: 1,
          averageDifference: 1.93,
          screenshots: [
            {
              filepath: '/path/to/screenshots/monitor_1.png',
              timestamp: new Date(Date.now() - 10000).toISOString(),
              differencePercentage: 0.8,
              hasSignificantChange: false
            },
            {
              filepath: '/path/to/screenshots/monitor_2.png',
              timestamp: new Date(Date.now() - 5000).toISOString(),
              differencePercentage: 4.2,
              hasSignificantChange: true
            },
            {
              filepath: '/path/to/screenshots/monitor_3.png',
              timestamp: new Date().toISOString(),
              differencePercentage: 0.8,
              hasSignificantChange: false
            }
          ]
        }, null, 2)
      }]
    };

    await this.delay(1000);
    console.log('   📥 Stop Response:', JSON.stringify(stopResponse, null, 4));
    console.log('   ✅ Monitoring session completed with summary');
  }

  async demoFeedbackGeneration() {
    console.log('   🎯 Generating UI feedback from differences...');
    
    const mcpRequest = {
      method: 'tools/call',
      params: {
        name: 'analyze_ui_feedback',
        arguments: {
          diffImagePath: '/path/to/comparisons/diff_example.png',
          options: {
            priority: ['layout', 'colors', 'spacing'],
            context: 'Testing button alignment and color consistency',
            suggestionsType: 'both'
          }
        }
      }
    };

    console.log('   📤 MCP Request:', JSON.stringify(mcpRequest, null, 4));
    
    const mockResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          summary: 'Analysis detected 3 visual differences. 1 high priority issue should be addressed. 2 medium priority issues detected. Context: Testing button alignment and color consistency. 4 actionable suggestions provided for improvement.',
          issues: [
            {
              type: 'layout',
              severity: 'high',
              description: 'Large layout change detected (300x100 pixels)',
              location: { x: 150, y: 200, width: 300, height: 100 }
            },
            {
              type: 'colors',
              severity: 'medium', 
              description: 'Significant color differences detected (12% of image)'
            },
            {
              type: 'spacing',
              severity: 'medium',
              description: 'Minor spacing adjustment detected',
              location: { x: 300, y: 150, width: 8, height: 5 }
            }
          ],
          suggestions: [
            {
              type: 'css',
              title: 'Fix Layout Positioning',
              description: 'Adjust element positioning to match the reference design',
              code: '/* Adjust positioning for layout fix */\\n.target-element {\\n  position: relative;\\n  top: 200px;\\n  left: 150px;\\n  /* Or consider using margin/padding adjustments */\\n  margin-top: 20px;\\n  margin-left: 15px;\\n}',
              priority: 1
            },
            {
              type: 'css',
              title: 'Color Correction',
              description: 'Update colors to match the reference design',
              code: '/* Color correction based on difference analysis */\\n.target-element {\\n  /* Review and adjust these color properties: */\\n  background-color: /* update to match reference */;\\n  color: /* update text color if needed */;\\n  border-color: /* update border color if applicable */;\\n}',
              priority: 2
            },
            {
              type: 'general',
              title: 'Layout Alignment Issue',
              description: 'Check element positioning, margins, and padding to ensure proper alignment',
              priority: 1
            },
            {
              type: 'css',
              title: 'Spacing Adjustment',
              description: 'Fine-tune margins and padding',
              code: '/* Spacing adjustments */\\n.target-element {\\n  margin: 1px;\\n  padding: 1px;\\n  /* Or more specific adjustments: */\\n  margin-top: 1px;\\n  margin-bottom: 1px;\\n}',
              priority: 3
            }
          ],
          priority: 'layout, colors, spacing',
          confidence: 75
        }, null, 2)
      }]
    };

    await this.delay(3000);
    console.log('   📥 MCP Response:', JSON.stringify(mockResponse, null, 4));
    console.log('   ✨ Generated 4 actionable suggestions with 75% confidence');
    console.log('   🎯 Includes both CSS code snippets and general guidance');
  }

  async demoTestAppIntegration() {
    console.log('   🌐 Demonstrating test app integration...');
    console.log('   💡 The test app provides a controlled environment for visual testing');
    
    console.log('\\n   📋 Test App Features:');
    console.log('     • Multiple layout modes (Default, Compact, Wide)');
    console.log('     • Dynamic color changes');
    console.log('     • Element addition/removal');
    console.log('     • Intentional layout breaking');
    console.log('     • Progress indicators and status updates');
    
    console.log('\\n   🚀 To use the test app:');
    console.log('     1. cd test-app && npm install && npm run dev');
    console.log('     2. Open http://localhost:5173 in browser');
    console.log('     3. Use MCP tools to screenshot different states');
    console.log('     4. Compare against reference designs');
    
    const exampleWorkflow = [
      '1. Take baseline screenshot in default layout',
      '2. Switch to compact layout and screenshot',
      '3. Compare the two screenshots',
      '4. Start monitoring session',
      '5. Make changes and observe monitoring results',
      '6. Generate feedback for improvements'
    ];

    console.log('\\n   📝 Example workflow:');
    exampleWorkflow.forEach(step => console.log('     ' + step));
    
    console.log('\\n   📁 Reference designs should be placed in:');
    console.log('     test-app/reference-designs/');
    console.log('     • default-layout.png');
    console.log('     • compact-layout.png');
    console.log('     • wide-layout.png');
    
    console.log('\\n   🔧 Integration with Claude Code:');
    console.log('     Add to your Claude Code MCP settings:');
    console.log('     {');
    console.log('       "mcps": {');
    console.log('         "visual-mcp": {');
    console.log('           "command": "node",');
    console.log('           "args": ["dist/index.js"],');
    console.log('           "cwd": "/path/to/VisualMCP"');
    console.log('         }');
    console.log('       }');
    console.log('     }');
  }

  async waitForKeyPress() {
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }
    if (this.testAppProcess) {
      this.testAppProcess.kill();
    }
    console.log('\\n🧹 Demo cleanup completed');
    console.log('\\n🎉 Visual MCP Demo finished!');
    console.log('   Next steps:');
    console.log('   • Try the test app: cd test-app && npm run dev');
    console.log('   • Run tests: node cli-tools/test-runner.js');
    console.log('   • Integrate with Claude Code using the MCP configuration');
  }
}

// CLI interface
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const demo = new VisualMCPDemo();
  demo.runDemo().catch(error => {
    console.error('Fatal demo error:', error);
    process.exit(1);
  });
}