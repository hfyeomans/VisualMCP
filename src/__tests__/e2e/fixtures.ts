import path from 'path';

import fs from 'fs-extra';

export const TEST_DATA_DIR = path.join(process.cwd(), 'test-e2e-data');
export const TEST_SCREENSHOTS_DIR = path.join(TEST_DATA_DIR, 'screenshots');
export const TEST_COMPARISONS_DIR = path.join(TEST_DATA_DIR, 'comparisons');

export interface TestFixtures {
  testImagePath: string;
  referenceImagePath: string;
}

export async function setupTestFixtures(): Promise<TestFixtures> {
  // Ensure directories exist
  await fs.ensureDir(TEST_SCREENSHOTS_DIR);
  await fs.ensureDir(TEST_COMPARISONS_DIR);

  // Create minimal test PNG images (1x1 pixels)
  const testImagePath = path.join(TEST_SCREENSHOTS_DIR, 'test-current.png');
  const referenceImagePath = path.join(TEST_SCREENSHOTS_DIR, 'test-reference.png');

  // Minimal PNG file structure (1x1 transparent pixel)
  const minimalPNG = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1 dimensions
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x15,
    0xc4,
    0x89, // IHDR CRC
    0x00,
    0x00,
    0x00,
    0x0a,
    0x49,
    0x44,
    0x41,
    0x54, // IDAT chunk
    0x78,
    0x9c,
    0x62,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0x0d,
    0x0a,
    0x2d,
    0xb4, // IDAT data & CRC
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82 // IEND chunk
  ]);

  await fs.writeFile(testImagePath, minimalPNG);
  await fs.writeFile(referenceImagePath, minimalPNG);

  return {
    testImagePath,
    referenceImagePath
  };
}

export async function cleanupTestFixtures(): Promise<void> {
  await fs.remove(TEST_DATA_DIR);
}

export const EXPECTED_TOOLS = [
  'take_screenshot',
  'compare_visuals',
  'analyze_ui_feedback',
  'start_monitoring',
  'stop_monitoring'
];

export const TOOL_SCHEMAS = {
  take_screenshot: {
    requiredParams: ['target'],
    optionalParams: ['options']
  },
  compare_visuals: {
    requiredParams: ['currentImage', 'referenceImage'],
    optionalParams: ['options']
  },
  analyze_ui_feedback: {
    requiredParams: ['diffImagePath'],
    optionalParams: ['options']
  },
  start_monitoring: {
    requiredParams: ['target', 'referenceImage'],
    optionalParams: ['interval', 'autoFeedback']
  },
  stop_monitoring: {
    requiredParams: ['sessionId']
  }
};

// This file contains fixture utilities for E2E tests
// Jest requires at least one test per test file, but this is a fixture file
// So we add a dummy describe block to satisfy Jest
describe('E2E Test Fixtures', () => {
  it('should export fixture utilities', () => {
    expect(typeof setupTestFixtures).toBe('function');
    expect(typeof cleanupTestFixtures).toBe('function');
    expect(Array.isArray(EXPECTED_TOOLS)).toBe(true);
    expect(typeof TOOL_SCHEMAS).toBe('object');
  });
});
