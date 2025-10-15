import { ChildProcess } from 'child_process';
import path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface TestServerOptions {
  serverPath?: string;
  timeout?: number;
}

export class TestMCPServer {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private _serverProcess: ChildProcess | null = null;

  async start(options: TestServerOptions = {}): Promise<Client> {
    const serverPath = options.serverPath || path.join(process.cwd(), 'dist', 'index.js');
    const timeout = options.timeout || 10000;

    // Create transport
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath]
    });

    // Create client
    this.client = new Client(
      {
        name: 'e2e-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    // Connect with timeout
    await Promise.race([
      this.client.connect(this.transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Server connection timeout')), timeout)
      )
    ]);

    return this.client;
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this._serverProcess) {
      this._serverProcess.kill();
      this._serverProcess = null;
    }

    this.transport = null;
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Server not started. Call start() first.');
    }
    return this.client;
  }
}

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}

// This file contains helper utilities for E2E tests
// Jest requires at least one test per test file, but this is a helper file
// So we add a dummy describe block to satisfy Jest
describe('E2E Test Helpers', () => {
  it('should export helper utilities', () => {
    expect(typeof TestMCPServer).toBe('function');
    expect(typeof waitForCondition).toBe('function');
  });
});
