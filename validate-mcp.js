#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Visual MCP Validation Script');
console.log('================================\n');

async function validateMCP() {
  const checks = [
    {
      name: 'Check Node.js version',
      test: () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        if (major >= 18) {
          return { success: true, message: `Node.js ${version} ✅` };
        } else {
          return { success: false, message: `Node.js ${version} - requires >= 18` };
        }
      }
    },
    {
      name: 'Check dist folder exists',
      test: () => {
        const distPath = path.join(__dirname, 'dist');
        if (fs.existsSync(distPath)) {
          return { success: true, message: 'dist/ folder exists ✅' };
        } else {
          return { success: false, message: 'dist/ folder missing - run "npm run build"' };
        }
      }
    },
    {
      name: 'Check index.js exists',
      test: () => {
        const indexPath = path.join(__dirname, 'dist', 'index.js');
        if (fs.existsSync(indexPath)) {
          return { success: true, message: 'dist/index.js exists ✅' };
        } else {
          return { success: false, message: 'dist/index.js missing - run "npm run build"' };
        }
      }
    },
    {
      name: 'Check dependencies installed',
      test: () => {
        const nodeModulesPath = path.join(__dirname, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
          return { success: true, message: 'node_modules/ exists ✅' };
        } else {
          return { success: false, message: 'node_modules/ missing - run "npm install"' };
        }
      }
    },
    {
      name: 'Test MCP server startup',
      test: () => {
        return new Promise((resolve) => {
          const serverProcess = spawn('node', ['dist/index.js'], {
            cwd: __dirname,
            stdio: 'pipe'
          });

          let output = '';
          let hasStarted = false;

          const timeout = setTimeout(() => {
            serverProcess.kill();
            if (hasStarted) {
              resolve({ success: true, message: 'MCP server starts successfully ✅' });
            } else {
              resolve({ success: false, message: 'MCP server failed to start' });
            }
          }, 3000);

          serverProcess.stderr.on('data', (data) => {
            output += data.toString();
            if (output.includes('Visual MCP Server running on stdio')) {
              hasStarted = true;
              clearTimeout(timeout);
              serverProcess.kill();
              resolve({ success: true, message: 'MCP server starts successfully ✅' });
            }
          });

          serverProcess.on('error', (error) => {
            clearTimeout(timeout);
            resolve({ success: false, message: `MCP server error: ${error.message}` });
          });
        });
      }
    }
  ];

  console.log('Running validation checks...\n');

  let allPassed = true;
  for (const check of checks) {
    process.stdout.write(`${check.name}... `);
    try {
      const result = await check.test();
      if (result.success) {
        console.log(result.message);
      } else {
        console.log(`❌ ${result.message}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 All checks passed! Visual MCP is ready to use.');
    console.log('\nNext steps:');
    console.log('1. Add the MCP configuration to Claude Code:');
    console.log('   {');
    console.log('     "mcps": {');
    console.log('       "visual-mcp": {');
    console.log('         "command": "node",');
    console.log('         "args": ["dist/index.js"],');
    console.log(`         "cwd": "${__dirname}"`);
    console.log('       }');
    console.log('     }');
    console.log('   }');
    console.log('\n2. Restart Claude Code');
    console.log('3. Try the interactive demo: node cli-tools/demo.js');
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.');
    console.log('\nCommon fixes:');
    console.log('- Run: npm install');
    console.log('- Run: npm run build');
    console.log('- Ensure Node.js >= 18');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateMCP().catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
}