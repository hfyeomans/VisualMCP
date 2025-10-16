#!/usr/bin/env node
import { chmod } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const binaryPath = path.join(__dirname, '../bin/screencapture-helper')

try {
  await chmod(binaryPath, 0o755)
  console.log('✅ Visual MCP: Native capture helper configured')
} catch (error) {
  // Silent fail on non-macOS or if binary missing
  if (process.platform === 'darwin') {
    console.warn('⚠️  Visual MCP: Native capture helper not found (macOS features unavailable)')
  }
}
