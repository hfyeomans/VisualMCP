import fs from 'fs-extra';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import {
  ComparisonOptions,
  ComparisonResult,
  DifferenceRegion,
  ImageMetadata
} from '../types/index.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('ComparisonEngine');

export class ComparisonEngine {
  private outputDir: string;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'comparisons');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!this.initPromise) {
      this.initPromise = fs
        .ensureDir(this.outputDir)
        .then(() => {
          this.initialized = true;
        })
        .finally(() => {
          this.initPromise = null;
        });
    }

    await this.initPromise;
  }

  async init(): Promise<void> {
    await this.ensureInitialized();
  }

  async compare(
    currentImagePath: string,
    referenceImagePath: string,
    options: ComparisonOptions = {}
  ): Promise<ComparisonResult> {
    await this.ensureInitialized();

    // Validate input files exist
    if (!(await fs.pathExists(currentImagePath))) {
      throw new Error(`Current image not found: ${currentImagePath}`);
    }
    if (!(await fs.pathExists(referenceImagePath))) {
      throw new Error(`Reference image not found: ${referenceImagePath}`);
    }

    // Get image metadata
    const currentMetadata = await this.getImageMetadata(currentImagePath);
    const referenceMetadata = await this.getImageMetadata(referenceImagePath);

    // Resize images to match if needed
    const { current, reference } = await this.prepareImagesForComparison(
      currentImagePath,
      referenceImagePath,
      currentMetadata,
      referenceMetadata
    );

    // Load images as PNG buffers
    const currentPng = await this.loadImageAsPng(current.path);
    const referencePng = await this.loadImageAsPng(reference.path);

    // Create diff image
    const diffPng = new PNG({ width: currentPng.width, height: currentPng.height });

    // Apply ignore regions by masking them
    if (options.ignoreRegions && options.ignoreRegions.length > 0) {
      this.applyIgnoreRegions(currentPng, referencePng, options.ignoreRegions);
    }

    // Perform pixel comparison
    const pixelsDifferent = pixelmatch(
      currentPng.data,
      referencePng.data,
      diffPng.data,
      currentPng.width,
      currentPng.height,
      {
        threshold: options.threshold || 0.1,
        includeAA: options.includeAA !== false,
        diffColor: [255, 0, 0], // Red for differences
        aaColor: [255, 255, 0], // Yellow for anti-aliasing differences
        diffColorAlt: [0, 255, 255] // Cyan for alternative diff color
      }
    );

    // Save diff image
    const diffImagePath = path.join(
      this.outputDir,
      `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`
    );
    await this.savePngImage(diffPng, diffImagePath);

    // Calculate results
    const totalPixels = currentPng.width * currentPng.height;
    const differencePercentage = (pixelsDifferent / totalPixels) * 100;
    const isMatch = differencePercentage <= (options.tolerance || 5);

    // Find difference regions
    const regions = await this.findDifferenceRegions(diffPng, options);

    // Clean up temporary files if they were created
    if (current.isTemporary) {
      await fs.remove(current.path);
    }
    if (reference.isTemporary) {
      await fs.remove(reference.path);
    }

    return {
      differencePercentage: Math.round(differencePercentage * 100) / 100,
      pixelsDifferent,
      totalPixels,
      diffImagePath,
      isMatch,
      regions,
      metadata: {
        currentImage: currentMetadata,
        referenceImage: referenceMetadata,
        comparison: options
      }
    };
  }

  private async getImageMetadata(imagePath: string): Promise<ImageMetadata> {
    const stats = await fs.stat(imagePath);
    const metadata = await sharp(imagePath).metadata();

    return {
      path: imagePath,
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: stats.size,
      timestamp: stats.mtime.toISOString()
    };
  }

  private async prepareImagesForComparison(
    currentImagePath: string,
    referenceImagePath: string,
    currentMetadata: ImageMetadata,
    referenceMetadata: ImageMetadata
  ): Promise<{
    current: { path: string; isTemporary: boolean };
    reference: { path: string; isTemporary: boolean };
  }> {
    const result = {
      current: { path: currentImagePath, isTemporary: false },
      reference: { path: referenceImagePath, isTemporary: false }
    };

    // Check if images have different dimensions
    if (
      currentMetadata.width !== referenceMetadata.width ||
      currentMetadata.height !== referenceMetadata.height
    ) {
      // Determine target dimensions (use the larger image as reference)
      const targetWidth = Math.max(currentMetadata.width, referenceMetadata.width);
      const targetHeight = Math.max(currentMetadata.height, referenceMetadata.height);

      // Resize current image if needed
      if (currentMetadata.width !== targetWidth || currentMetadata.height !== targetHeight) {
        const tempCurrentPath = path.join(this.outputDir, `temp_current_${Date.now()}.png`);
        await sharp(currentImagePath)
          .resize(targetWidth, targetHeight, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png()
          .toFile(tempCurrentPath);

        result.current = { path: tempCurrentPath, isTemporary: true };
      }

      // Resize reference image if needed
      if (referenceMetadata.width !== targetWidth || referenceMetadata.height !== targetHeight) {
        const tempReferencePath = path.join(this.outputDir, `temp_reference_${Date.now()}.png`);
        await sharp(referenceImagePath)
          .resize(targetWidth, targetHeight, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png()
          .toFile(tempReferencePath);

        result.reference = { path: tempReferencePath, isTemporary: true };
      }
    }

    return result;
  }

  private async loadImageAsPng(imagePath: string): Promise<PNG> {
    const buffer = await fs.readFile(imagePath);

    // Convert to PNG if not already
    let pngBuffer: Buffer;
    try {
      // Try to parse as PNG directly
      const png = PNG.sync.read(buffer);
      return png;
    } catch {
      // Convert using Sharp
      pngBuffer = await sharp(buffer).png().toBuffer();
      return PNG.sync.read(pngBuffer);
    }
  }

  private async savePngImage(png: PNG, outputPath: string): Promise<void> {
    const buffer = PNG.sync.write(png);
    await fs.writeFile(outputPath, buffer);
  }

  private applyIgnoreRegions(
    currentPng: PNG,
    referencePng: PNG,
    ignoreRegions: Array<{ x: number; y: number; width: number; height: number }>
  ): void {
    for (const region of ignoreRegions) {
      for (let y = region.y; y < region.y + region.height && y < currentPng.height; y++) {
        for (let x = region.x; x < region.x + region.width && x < currentPng.width; x++) {
          const idx = (currentPng.width * y + x) << 2;

          // Set both images to the same color in ignore regions (gray)
          currentPng.data[idx] = 128; // R
          currentPng.data[idx + 1] = 128; // G
          currentPng.data[idx + 2] = 128; // B
          currentPng.data[idx + 3] = 255; // A

          referencePng.data[idx] = 128; // R
          referencePng.data[idx + 1] = 128; // G
          referencePng.data[idx + 2] = 128; // B
          referencePng.data[idx + 3] = 255; // A
        }
      }
    }
  }

  private async findDifferenceRegions(
    diffPng: PNG,
    _options: ComparisonOptions
  ): Promise<DifferenceRegion[]> {
    const regions: DifferenceRegion[] = [];
    const visited = new Set<string>();
    const minRegionSize = 10; // Minimum region size to consider

    for (let y = 0; y < diffPng.height; y++) {
      for (let x = 0; x < diffPng.width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const idx = (diffPng.width * y + x) << 2;
        const r = diffPng.data[idx] || 0;
        const g = diffPng.data[idx + 1] || 0;
        const b = diffPng.data[idx + 2] || 0;

        // Check if this pixel indicates a difference (red or yellow)
        if (
          (r > 200 && g < 100 && b < 100) || // Red - difference
          (r > 200 && g > 200 && b < 100)
        ) {
          // Yellow - AA difference

          // Find the bounding box of connected different pixels
          const region = this.floodFill(diffPng, x, y, visited);

          if (region.width >= minRegionSize || region.height >= minRegionSize) {
            // Determine severity based on size and color intensity
            const area = region.width * region.height;
            const severity: 'low' | 'medium' | 'high' =
              area > 1000 ? 'high' : area > 100 ? 'medium' : 'low';

            regions.push({
              ...region,
              severity
            });
          }
        }
      }
    }

    return regions;
  }

  private floodFill(
    png: PNG,
    startX: number,
    startY: number,
    visited: Set<string>
  ): DifferenceRegion {
    const stack = [{ x: startX, y: startY }];
    let minX = startX,
      maxX = startX;
    let minY = startY,
      maxY = startY;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= png.width || y < 0 || y >= png.height) {
        continue;
      }

      const idx = (png.width * y + x) << 2;
      const r = png.data[idx] || 0;
      const g = png.data[idx + 1] || 0;
      const b = png.data[idx + 2] || 0;

      // Check if this pixel indicates a difference
      if (!((r > 200 && g < 100 && b < 100) || (r > 200 && g > 200 && b < 100))) {
        continue;
      }

      visited.add(key);

      // Update bounds
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Add adjacent pixels
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      severity: 'medium' // Will be updated by caller
    };
  }

  async listComparisons(): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const files = await fs.readdir(this.outputDir);
      return files
        .filter(file => file.startsWith('diff_') && file.endsWith('.png'))
        .map(file => path.join(this.outputDir, file));
    } catch (error) {
      logger.error('Error listing comparisons', error as Error);
      return [];
    }
  }

  async deleteComparison(filepath: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      await fs.remove(filepath);
      return true;
    } catch (error) {
      logger.error('Error deleting comparison', error as Error);
      return false;
    }
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }

  setOutputDirectory(dir: string): void {
    this.outputDir = dir;
    this.initialized = false;
    this.initPromise = null;
  }
}
