import { EventEmitter } from 'events';
import { ICleanupManager } from '../interfaces/index.js';
import { createLogger } from './logger.js';
import { browserManager } from './browser-manager.js';

const logger = createLogger('ResourceManager');

/**
 * Manages cleanup operations across the application
 */
export class CleanupManager extends EventEmitter implements ICleanupManager {
  private cleanupHandlers = new Map<string, () => Promise<void>>();
  private isShuttingDown = false;

  constructor() {
    super();
    this.setupProcessHandlers();
    logger.debug('CleanupManager initialized');
  }

  private setupProcessHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;

      logger.info('Shutdown signal received', { signal });
      this.isShuttingDown = true;

      try {
        await this.cleanup();
        logger.info('Cleanup completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during cleanup', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async error => {
      logger.error('Uncaught exception, shutting down', error);
      await shutdown('uncaughtException');
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled promise rejection, shutting down', new Error(String(reason)), {
        promise
      });
      await shutdown('unhandledRejection');
    });
  }

  registerCleanupHandler(name: string, handler: () => Promise<void>): void {
    logger.debug('Registering cleanup handler', { name });
    this.cleanupHandlers.set(name, handler);
    this.emit('handler_registered', { name });
  }

  removeCleanupHandler(name: string): void {
    if (this.cleanupHandlers.delete(name)) {
      logger.debug('Cleanup handler removed', { name });
      this.emit('handler_removed', { name });
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleanupHandlers.size === 0) {
      logger.debug('No cleanup handlers to execute');
      return;
    }

    logger.info('Starting cleanup', { handlersCount: this.cleanupHandlers.size });
    this.emit('cleanup_started');

    const results = await Promise.allSettled(
      Array.from(this.cleanupHandlers.entries()).map(async ([name, handler]) => {
        try {
          logger.debug('Executing cleanup handler', { name });
          await handler();
          logger.debug('Cleanup handler completed', { name });
        } catch (error) {
          logger.error('Cleanup handler failed', error as Error, { name });
          throw error;
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some cleanup handlers failed', {
        failures: failures.length,
        total: results.length
      });
    }

    this.emit('cleanup_completed', {
      total: results.length,
      failures: failures.length
    });

    logger.info('Cleanup completed', {
      total: results.length,
      failures: failures.length
    });
  }
}

/**
 * Resource pool for managing reusable resources
 */
export class ResourcePool<T> extends EventEmitter {
  private available: T[] = [];
  private inUse = new Set<T>();
  private maxSize: number;
  private createResource: () => Promise<T>;
  private destroyResource: (resource: T) => Promise<void>;

  constructor(
    maxSize: number,
    createResource: () => Promise<T>,
    destroyResource: (resource: T) => Promise<void>
  ) {
    super();
    this.maxSize = maxSize;
    this.createResource = createResource;
    this.destroyResource = destroyResource;

    logger.debug('ResourcePool created', { maxSize });
  }

  async acquire(): Promise<T> {
    // Try to get available resource
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      this.inUse.add(resource);
      logger.debug('Resource acquired from pool', {
        availableCount: this.available.length,
        inUseCount: this.inUse.size
      });
      return resource;
    }

    // Create new resource if under limit
    if (this.inUse.size < this.maxSize) {
      try {
        const resource = await this.createResource();
        this.inUse.add(resource);
        logger.debug('New resource created', {
          availableCount: this.available.length,
          inUseCount: this.inUse.size
        });
        this.emit('resource_created', { resource });
        return resource;
      } catch (error) {
        logger.error('Failed to create resource', error as Error);
        throw error;
      }
    }

    // Wait for resource to become available
    return new Promise<T>(resolve => {
      this.once('resource_released', () => {
        this.acquire()
          .then(resolve)
          .catch(() => {
            // Retry on error
            setTimeout(() => this.acquire().then(resolve), 100);
          });
      });
    });
  }

  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      logger.warn('Attempting to release resource not in use');
      return;
    }

    this.inUse.delete(resource);
    this.available.push(resource);

    logger.debug('Resource released', {
      availableCount: this.available.length,
      inUseCount: this.inUse.size
    });

    this.emit('resource_released', { resource });
  }

  async destroy(): Promise<void> {
    logger.info('Destroying resource pool', {
      availableCount: this.available.length,
      inUseCount: this.inUse.size
    });

    // Destroy all resources
    const allResources = [...this.available, ...this.inUse];
    const destroyPromises = allResources.map(async resource => {
      try {
        await this.destroyResource(resource);
      } catch (error) {
        logger.warn('Error destroying resource', { error: (error as Error).message });
      }
    });

    await Promise.allSettled(destroyPromises);

    this.available.length = 0;
    this.inUse.clear();
    this.removeAllListeners();

    logger.info('Resource pool destroyed');
  }

  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }
}

// Export singleton instances
export const cleanupManager = new CleanupManager();

// Register browser manager with cleanup manager
browserManager.registerCleanup(cleanupManager);

export { browserManager };
