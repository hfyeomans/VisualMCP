import fs from 'fs-extra';
import path from 'path';
import { MetadataPersistenceService } from '../../analysis/metadata-persistence.js';
import { FeedbackResult } from '../../types/index.js';

const TEST_METADATA_DIR = path.join(process.cwd(), 'test-metadata');

describe('MetadataPersistenceService', () => {
  let service: MetadataPersistenceService;

  beforeEach(async () => {
    // Clean up test directory
    await fs.remove(TEST_METADATA_DIR);
    service = new MetadataPersistenceService(TEST_METADATA_DIR, true);
    await service.init();
  });

  afterEach(async () => {
    await fs.remove(TEST_METADATA_DIR);
  });

  describe('saveMetadata', () => {
    it('saves feedback result to JSON file', async () => {
      const result: FeedbackResult = {
        summary: 'Test summary',
        issues: [{ type: 'layout', severity: 'medium', description: 'Test issue' }],
        suggestions: [{ type: 'css', title: 'Test', description: 'Test suggestion', priority: 1 }],
        priority: 'layout',
        confidence: 85
      };

      const metadataPath = await service.saveMetadata('/path/to/diff_123.png', result);

      expect(metadataPath).toBeTruthy();
      expect(await fs.pathExists(metadataPath!)).toBe(true);

      const savedData = await fs.readJson(metadataPath!);
      expect(savedData.summary).toBe('Test summary');
      expect(savedData.diffImagePath).toBe('/path/to/diff_123.png');
      expect(savedData.analyzedAt).toBeTruthy();
      expect(savedData.analysisVersion).toBe('1.0.0');
    });

    it('returns null when persistence is disabled', async () => {
      const disabledService = new MetadataPersistenceService(TEST_METADATA_DIR, false);
      const result: FeedbackResult = {
        summary: 'Test',
        issues: [],
        suggestions: [],
        priority: 'layout',
        confidence: 100
      };

      const metadataPath = await disabledService.saveMetadata('/path/to/diff.png', result);
      expect(metadataPath).toBeNull();
    });
  });

  describe('loadMetadata', () => {
    it('loads saved metadata', async () => {
      const result: FeedbackResult = {
        summary: 'Test summary',
        issues: [],
        suggestions: [],
        priority: 'colors',
        confidence: 90
      };

      await service.saveMetadata('/path/to/diff_456.png', result);
      const loaded = await service.loadMetadata('/path/to/diff_456.png');

      expect(loaded).toBeTruthy();
      expect(loaded?.summary).toBe('Test summary');
      expect(loaded?.confidence).toBe(90);
    });

    it('returns null when metadata file does not exist', async () => {
      const loaded = await service.loadMetadata('/path/to/nonexistent.png');
      expect(loaded).toBeNull();
    });

    it('returns null when persistence is disabled', async () => {
      const disabledService = new MetadataPersistenceService(TEST_METADATA_DIR, false);
      const loaded = await disabledService.loadMetadata('/path/to/diff.png');
      expect(loaded).toBeNull();
    });
  });

  describe('listMetadata', () => {
    it('lists all metadata files', async () => {
      const result: FeedbackResult = {
        summary: 'Test',
        issues: [],
        suggestions: [],
        priority: 'layout',
        confidence: 100
      };

      await service.saveMetadata('/path/to/diff_1.png', result);
      await service.saveMetadata('/path/to/diff_2.png', result);

      const files = await service.listMetadata();
      expect(files.length).toBe(2);
    });

    it('returns empty array when no metadata exists', async () => {
      const files = await service.listMetadata();
      expect(files).toEqual([]);
    });
  });

  describe('deleteMetadata', () => {
    it('deletes metadata file', async () => {
      const result: FeedbackResult = {
        summary: 'Test',
        issues: [],
        suggestions: [],
        priority: 'layout',
        confidence: 100
      };

      await service.saveMetadata('/path/to/diff_789.png', result);
      const deleted = await service.deleteMetadata('/path/to/diff_789.png');

      expect(deleted).toBe(true);

      const loaded = await service.loadMetadata('/path/to/diff_789.png');
      expect(loaded).toBeNull();
    });

    it('returns false when file does not exist', async () => {
      const deleted = await service.deleteMetadata('/path/to/nonexistent.png');
      expect(deleted).toBe(false);
    });
  });
});
