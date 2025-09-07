import { IDependencyContainer } from '../interfaces/index.js';
import { createLogger } from './logger.js';

const logger = createLogger('Container');

/**
 * Simple dependency injection container
 */
export class Container implements IDependencyContainer {
  private factories = new Map<string | symbol, () => any>();
  private singletons = new Map<string | symbol, any>();
  private singletonFactories = new Map<string | symbol, () => any>();

  register<T>(key: string | symbol, factory: () => T): void {
    logger.debug('Registering factory', { key: key.toString() });
    this.factories.set(key, factory);
  }

  registerSingleton<T>(key: string | symbol, factory: () => T): void {
    logger.debug('Registering singleton factory', { key: key.toString() });
    this.singletonFactories.set(key, factory);
  }

  registerInstance<T>(key: string | symbol, instance: T): void {
    logger.debug('Registering instance', { key: key.toString() });
    this.singletons.set(key, instance);
  }

  resolve<T>(key: string | symbol): T {
    // Check if already created singleton
    if (this.singletons.has(key)) {
      logger.debug('Resolving singleton from cache', { key: key.toString() });
      return this.singletons.get(key) as T;
    }

    // Create singleton if factory exists
    if (this.singletonFactories.has(key)) {
      logger.debug('Creating singleton', { key: key.toString() });
      const factory = this.singletonFactories.get(key)!;
      const instance = factory();
      this.singletons.set(key, instance);
      return instance as T;
    }

    // Create transient instance
    if (this.factories.has(key)) {
      logger.debug('Creating transient instance', { key: key.toString() });
      const factory = this.factories.get(key)!;
      return factory() as T;
    }

    throw new Error(`No registration found for key: ${key.toString()}`);
  }

  isRegistered(key: string | symbol): boolean {
    return this.factories.has(key) || 
           this.singletonFactories.has(key) || 
           this.singletons.has(key);
  }

  clear(): void {
    logger.debug('Clearing container');
    this.factories.clear();
    this.singletons.clear();
    this.singletonFactories.clear();
  }

  getRegisteredKeys(): (string | symbol)[] {
    const keys = new Set([
      ...this.factories.keys(),
      ...this.singletonFactories.keys(),
      ...this.singletons.keys()
    ]);
    return Array.from(keys);
  }
}

// Export singleton instance
export const container = new Container();