import path from 'path';

import fs from 'fs-extra';

import { FileWriteError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';
import { FeedbackResult } from '../types/index.js';

const logger = createLogger('MetadataPersistence');

export interface AnalysisMetadata extends FeedbackResult {
  diffImagePath: string;
  analyzedAt: string;
  analysisVersion: string;
}

/**
 * Handles persistence of analysis metadata to JSON sidecars
 */
export class MetadataPersistenceService {
  constructor(
    private readonly metadataDirectory: string,
    private readonly enabled: boolean = true
  ) {}

  /**
   * Initialize metadata directory
   */
  async init(): Promise<void> {
    if (!this.enabled) return;

    try {
      await fs.ensureDir(this.metadataDirectory);
      logger.debug('Metadata directory ensured', { directory: this.metadataDirectory });
    } catch (error) {
      logger.warn(
        'Failed to create metadata directory',
        { directory: this.metadataDirectory },
        error as Error
      );
    }
  }

  /**
   * Save analysis metadata to JSON file
   */
  async saveMetadata(diffImagePath: string, result: FeedbackResult): Promise<string | null> {
    if (!this.enabled) {
      logger.debug('Metadata persistence disabled, skipping');
      return null;
    }

    try {
      // Generate metadata filename based on diff image name
      const diffBasename = path.basename(diffImagePath, path.extname(diffImagePath));
      const metadataFilename = `${diffBasename}_metadata.json`;
      const metadataPath = path.join(this.metadataDirectory, metadataFilename);

      // Create metadata object
      const metadata: AnalysisMetadata = {
        ...result,
        diffImagePath,
        analyzedAt: new Date().toISOString(),
        analysisVersion: '1.0.0'
      };

      // Write to file
      await fs.writeJson(metadataPath, metadata, { spaces: 2 });

      logger.info('Analysis metadata saved', {
        metadataPath,
        issuesCount: result.issues.length,
        suggestionsCount: result.suggestions.length
      });

      return metadataPath;
    } catch (error) {
      logger.error('Failed to save analysis metadata', error as Error, { diffImagePath });
      throw new FileWriteError(diffImagePath, error as Error);
    }
  }

  /**
   * Load analysis metadata from JSON file
   */
  async loadMetadata(diffImagePath: string): Promise<AnalysisMetadata | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const diffBasename = path.basename(diffImagePath, path.extname(diffImagePath));
      const metadataFilename = `${diffBasename}_metadata.json`;
      const metadataPath = path.join(this.metadataDirectory, metadataFilename);

      if (!(await fs.pathExists(metadataPath))) {
        logger.debug('Metadata file not found', { metadataPath });
        return null;
      }

      const metadata = await fs.readJson(metadataPath);
      logger.debug('Analysis metadata loaded', { metadataPath });

      return metadata as AnalysisMetadata;
    } catch (error) {
      logger.warn('Failed to load analysis metadata', { diffImagePath }, error as Error);
      return null;
    }
  }

  /**
   * List all metadata files
   */
  async listMetadata(): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const files = await fs.readdir(this.metadataDirectory);
      return files
        .filter(file => file.endsWith('_metadata.json'))
        .map(file => path.join(this.metadataDirectory, file));
    } catch (error) {
      logger.warn(
        'Failed to list metadata files',
        { directory: this.metadataDirectory },
        error as Error
      );
      return [];
    }
  }

  /**
   * Delete metadata file
   */
  async deleteMetadata(diffImagePath: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const diffBasename = path.basename(diffImagePath, path.extname(diffImagePath));
      const metadataFilename = `${diffBasename}_metadata.json`;
      const metadataPath = path.join(this.metadataDirectory, metadataFilename);

      if (await fs.pathExists(metadataPath)) {
        await fs.remove(metadataPath);
        logger.debug('Metadata file deleted', { metadataPath });
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Failed to delete metadata file', { diffImagePath }, error as Error);
      return false;
    }
  }
}
