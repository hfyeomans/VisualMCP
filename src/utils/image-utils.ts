import fs from 'fs-extra';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import { IImageProcessor } from '../interfaces/index.js';
import { ImageLoadError, ImageFormatError, FileWriteError, FileReadError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('ImageUtils');

/**
 * Image processing utilities implementing IImageProcessor
 */
export class ImageProcessor implements IImageProcessor {
  async loadImage(imagePath: string): Promise<PNG> {
    try {
      logger.debug('Loading image', { imagePath });
      
      if (!await fs.pathExists(imagePath)) {
        throw new FileReadError(imagePath);
      }

      const buffer = await fs.readFile(imagePath);
      
      try {
        // Try to parse as PNG directly
        return PNG.sync.read(buffer);
      } catch {
        // Convert using Sharp if not PNG
        const pngBuffer = await sharp(buffer).png().toBuffer();
        return PNG.sync.read(pngBuffer);
      }
    } catch (error) {
      logger.error('Failed to load image', error as Error, { imagePath });
      throw new ImageLoadError(imagePath, error as Error);
    }
  }

  async saveImage(imageData: PNG, outputPath: string): Promise<void> {
    try {
      logger.debug('Saving image', { outputPath });
      
      const buffer = PNG.sync.write(imageData);
      await fs.writeFile(outputPath, buffer);
      
      logger.info('Image saved successfully', { outputPath, size: buffer.length });
    } catch (error) {
      logger.error('Failed to save image', error as Error, { outputPath });
      throw new FileWriteError(outputPath, error as Error);
    }
  }

  async resizeImage(imagePath: string, width: number, height: number): Promise<string> {
    try {
      logger.debug('Resizing image', { imagePath, width, height });
      
      const outputPath = this.generateTempPath(imagePath, `_resized_${width}x${height}`);
      
      await sharp(imagePath)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      logger.info('Image resized successfully', { 
        inputPath: imagePath, 
        outputPath, 
        dimensions: { width, height } 
      });
      
      return outputPath;
    } catch (error) {
      logger.error('Failed to resize image', error as Error, { imagePath, width, height });
      throw new ImageLoadError(imagePath, error as Error);
    }
  }

  async convertFormat(imagePath: string, format: 'png' | 'jpeg', outputPath?: string): Promise<string> {
    try {
      logger.debug('Converting image format', { imagePath, format, outputPath });
      
      const finalOutputPath = outputPath || this.generateTempPath(imagePath, `_converted.${format}`);
      
      const pipeline = sharp(imagePath);
      
      if (format === 'jpeg') {
        pipeline.jpeg({ quality: 90 });
      } else {
        pipeline.png();
      }
      
      await pipeline.toFile(finalOutputPath);
      
      logger.info('Image format converted', { 
        inputPath: imagePath, 
        outputPath: finalOutputPath, 
        format 
      });
      
      return finalOutputPath;
    } catch (error) {
      logger.error('Failed to convert image format', error as Error, { imagePath, format });
      throw new ImageFormatError(imagePath, format, error as Error);
    }
  }

  async getImageMetadata(imagePath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    try {
      logger.debug('Getting image metadata', { imagePath });
      
      const [metadata, stats] = await Promise.all([
        sharp(imagePath).metadata(),
        fs.stat(imagePath)
      ]);
      
      const result = {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: stats.size
      };
      
      logger.debug('Image metadata retrieved', { imagePath, metadata: result });
      
      return result;
    } catch (error) {
      logger.error('Failed to get image metadata', error as Error, { imagePath });
      throw new ImageLoadError(imagePath, error as Error);
    }
  }

  /**
   * Generate a temporary file path with suffix
   */
  private generateTempPath(originalPath: string, suffix: string): string {
    const parsed = require('path').parse(originalPath);
    return require('path').join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`);
  }

  /**
   * Prepare images for comparison by resizing to match dimensions
   */
  async prepareImagesForComparison(
    currentImagePath: string,
    referenceImagePath: string
  ): Promise<{ current: { path: string; isTemporary: boolean }, reference: { path: string; isTemporary: boolean } }> {
    logger.debug('Preparing images for comparison', { currentImagePath, referenceImagePath });
    
    const [currentMetadata, referenceMetadata] = await Promise.all([
      this.getImageMetadata(currentImagePath),
      this.getImageMetadata(referenceImagePath)
    ]);

    const result = {
      current: { path: currentImagePath, isTemporary: false },
      reference: { path: referenceImagePath, isTemporary: false }
    };

    // Check if images have different dimensions
    if (currentMetadata.width !== referenceMetadata.width || 
        currentMetadata.height !== referenceMetadata.height) {
      
      logger.info('Images have different dimensions, resizing', {
        current: { width: currentMetadata.width, height: currentMetadata.height },
        reference: { width: referenceMetadata.width, height: referenceMetadata.height }
      });

      // Determine target dimensions (use the larger image as reference)
      const targetWidth = Math.max(currentMetadata.width, referenceMetadata.width);
      const targetHeight = Math.max(currentMetadata.height, referenceMetadata.height);

      // Resize current image if needed
      if (currentMetadata.width !== targetWidth || currentMetadata.height !== targetHeight) {
        const resizedPath = await this.resizeImage(currentImagePath, targetWidth, targetHeight);
        result.current = { path: resizedPath, isTemporary: true };
      }

      // Resize reference image if needed
      if (referenceMetadata.width !== targetWidth || referenceMetadata.height !== targetHeight) {
        const resizedPath = await this.resizeImage(referenceImagePath, targetWidth, targetHeight);
        result.reference = { path: resizedPath, isTemporary: true };
      }
    }

    logger.debug('Images prepared for comparison', result);
    return result;
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(files: Array<{ path: string; isTemporary: boolean }>): Promise<void> {
    const tempFiles = files.filter(f => f.isTemporary).map(f => f.path);
    
    if (tempFiles.length === 0) return;
    
    logger.debug('Cleaning up temporary files', { files: tempFiles });
    
    await Promise.allSettled(
      tempFiles.map(async (file) => {
        try {
          await fs.remove(file);
          logger.debug('Temporary file removed', { file });
        } catch (error) {
          logger.warn('Failed to remove temporary file', { file }, error as Error);
        }
      })
    );
  }
}

/**
 * Utility functions for image operations
 */
export class ImageUtils {
  /**
   * Apply ignore regions by masking them to a neutral color
   */
  static applyIgnoreRegions(
    currentPng: PNG, 
    referencePng: PNG, 
    ignoreRegions: Array<{ x: number, y: number, width: number, height: number }>
  ): void {
    logger.debug('Applying ignore regions', { regionsCount: ignoreRegions.length });
    
    for (const region of ignoreRegions) {
      for (let y = region.y; y < region.y + region.height && y < currentPng.height; y++) {
        for (let x = region.x; x < region.x + region.width && x < currentPng.width; x++) {
          const idx = (currentPng.width * y + x) << 2;
          
          // Set both images to the same neutral color in ignore regions
          const neutralColor = [128, 128, 128, 255]; // Gray
          
          for (let i = 0; i < 4; i++) {
            currentPng.data[idx + i] = neutralColor[i];
            referencePng.data[idx + i] = neutralColor[i];
          }
        }
      }
    }
    
    logger.debug('Ignore regions applied successfully');
  }

  /**
   * Calculate image brightness
   */
  static calculateBrightness(data: Buffer, channels: number): number {
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      
      totalBrightness += (r + g + b) / 3;
      pixelCount++;
    }

    return pixelCount > 0 ? totalBrightness / pixelCount : 0;
  }

  /**
   * Calculate image contrast
   */
  static calculateContrast(data: Buffer, channels: number): number {
    let minBrightness = 255;
    let maxBrightness = 0;

    for (let i = 0; i < data.length; i += channels) {
      const brightness = ((data[i] || 0) + (data[i + 1] || 0) + (data[i + 2] || 0)) / 3;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    return maxBrightness - minBrightness;
  }

  /**
   * Extract dominant colors from image data
   */
  static extractDominantColors(data: Buffer, channels: number, maxColors: number = 5): Array<{ color: string; percentage: number }> {
    const colorCounts = new Map<string, number>();
    let totalPixels = 0;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;

      // Group similar colors (reduce precision for better grouping)
      const colorKey = `${Math.floor(r / 32)},${Math.floor(g / 32)},${Math.floor(b / 32)}`;
      colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
      totalPixels++;
    }

    return Array.from(colorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxColors)
      .map(([key, count]) => {
        const parts = key.split(',').map(n => parseInt(n || '0'));
        const r = (parts[0] || 0) * 32;
        const g = (parts[1] || 0) * 32;
        const b = (parts[2] || 0) * 32;
        
        return {
          color: `rgb(${r}, ${g}, ${b})`,
          percentage: Math.round((count / totalPixels) * 100)
        };
      });
  }
}

// Export singleton instance for convenience
export const imageProcessor = new ImageProcessor();