import fs from 'fs-extra';
import path from 'path';
import { IFileManager } from '../interfaces/index.js';
import { FileReadError, FileWriteError, DirectoryCreationError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('FileUtils');

/**
 * File management utilities implementing IFileManager
 */
export class FileManager implements IFileManager {
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      logger.debug('Ensuring directory exists', { path: dirPath });
      await fs.ensureDir(dirPath);
      logger.debug('Directory ensured', { path: dirPath });
    } catch (error) {
      logger.error('Failed to ensure directory', error as Error, { path: dirPath });
      throw new DirectoryCreationError(dirPath, error as Error);
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      logger.debug('Reading file', { path: filePath });
      const buffer = await fs.readFile(filePath);
      logger.debug('File read successfully', { path: filePath, size: buffer.length });
      return buffer;
    } catch (error) {
      logger.error('Failed to read file', error as Error, { path: filePath });
      throw new FileReadError(filePath, error as Error);
    }
  }

  async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    try {
      logger.debug('Writing file', { path: filePath, dataType: typeof data });

      // Ensure parent directory exists
      await this.ensureDirectory(path.dirname(filePath));

      await fs.writeFile(filePath, data);

      const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
      logger.info('File written successfully', { path: filePath, size });
    } catch (error) {
      logger.error('Failed to write file', error as Error, { path: filePath });
      throw new FileWriteError(filePath, error as Error);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      logger.debug('Deleting file', { path: filePath });
      await fs.remove(filePath);
      logger.info('File deleted successfully', { path: filePath });
    } catch (error) {
      logger.warn('Failed to delete file', { path: filePath }, error as Error);
      // Don't throw for delete operations - just log and continue
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const exists = await fs.pathExists(filePath);
      logger.debug('File existence check', { path: filePath, exists });
      return exists;
    } catch (error) {
      logger.warn('Error checking file existence', { path: filePath }, error as Error);
      return false;
    }
  }

  async listFiles(directory: string, extension?: string): Promise<string[]> {
    try {
      logger.debug('Listing files', { directory, extension });

      if (!(await this.exists(directory))) {
        logger.debug('Directory does not exist', { directory });
        return [];
      }

      const files = await fs.readdir(directory);
      const filteredFiles = extension
        ? files.filter(file => file.toLowerCase().endsWith(extension.toLowerCase()))
        : files;

      const fullPaths = filteredFiles.map(file => path.join(directory, file));

      // Filter to only include files (not directories)
      const actualFiles = [];
      for (const filePath of fullPaths) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            actualFiles.push(filePath);
          }
        } catch (error) {
          logger.warn('Error checking file stats', { path: filePath }, error as Error);
        }
      }

      logger.debug('Files listed', { directory, count: actualFiles.length, extension });
      return actualFiles;
    } catch (error) {
      logger.error('Failed to list files', error as Error, { directory, extension });
      return [];
    }
  }

  async getFileStats(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
  }> {
    try {
      logger.debug('Getting file stats', { path: filePath });

      const stats = await fs.stat(filePath);
      const result = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };

      logger.debug('File stats retrieved', { path: filePath, stats: result });
      return result;
    } catch (error) {
      logger.error('Failed to get file stats', error as Error, { path: filePath });
      throw new FileReadError(filePath, error as Error);
    }
  }
}

/**
 * Path utilities
 */
export class PathUtils {
  /**
   * Generate a unique filename with timestamp
   */
  static generateUniqueFileName(
    baseName: string,
    extension: string,
    includeTimestamp = true
  ): string {
    const timestamp = includeTimestamp ? `_${Date.now()}` : '';
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    return `${baseName}${timestamp}_${randomSuffix}.${extension}`;
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .slice(0, 255); // Limit length
  }

  /**
   * Get relative path from base directory
   */
  static getRelativePath(filePath: string, baseDir: string): string {
    return path.relative(baseDir, filePath);
  }

  /**
   * Check if path is within allowed directory
   */
  static isPathSafe(filePath: string, allowedDir: string): boolean {
    const resolved = path.resolve(filePath);
    const allowed = path.resolve(allowedDir);
    return resolved.startsWith(allowed);
  }

  /**
   * Ensure file extension is present
   */
  static ensureExtension(fileName: string, extension: string): string {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
  }
}

/**
 * Cleanup utilities
 */
export class CleanupUtils {
  /**
   * Clean up old files in directory based on age
   */
  static async cleanupOldFiles(
    directory: string,
    maxAge: number, // in milliseconds
    filePattern?: RegExp
  ): Promise<number> {
    logger.debug('Starting cleanup of old files', { directory, maxAge, filePattern });

    try {
      const fileManager = new FileManager();
      const files = await fileManager.listFiles(directory);
      const now = Date.now();
      let deletedCount = 0;

      for (const filePath of files) {
        try {
          // Check pattern if provided
          if (filePattern && !filePattern.test(path.basename(filePath))) {
            continue;
          }

          const stats = await fileManager.getFileStats(filePath);
          const age = now - stats.modified.getTime();

          if (age > maxAge) {
            await fileManager.deleteFile(filePath);
            deletedCount++;
            logger.debug('Old file deleted', {
              path: filePath,
              age: Math.round(age / 1000 / 60), // minutes
              maxAgeMinutes: Math.round(maxAge / 1000 / 60)
            });
          }
        } catch (error) {
          logger.warn('Error processing file during cleanup', { path: filePath }, error as Error);
        }
      }

      logger.info('Cleanup completed', {
        directory,
        deletedCount,
        totalFiles: files.length
      });

      return deletedCount;
    } catch (error) {
      logger.error('Cleanup failed', error as Error, { directory });
      return 0;
    }
  }

  /**
   * Clean up temporary files by pattern
   */
  static async cleanupTempFiles(tempDir: string): Promise<void> {
    logger.debug('Cleaning up temporary files', { tempDir });

    const tempFilePattern = /^(temp_|monitor_|diff_|resized_|converted_)/;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const deletedCount = await this.cleanupOldFiles(tempDir, maxAge, tempFilePattern);

    logger.info('Temporary files cleanup completed', {
      tempDir,
      deletedCount
    });
  }

  /**
   * Clean up large files to free space
   */
  static async cleanupLargeFiles(
    directory: string,
    maxSize: number, // in bytes
    keepCount: number = 10
  ): Promise<void> {
    logger.debug('Cleaning up large files', { directory, maxSize, keepCount });

    try {
      const fileManager = new FileManager();
      const files = await fileManager.listFiles(directory);

      // Get file stats and sort by size (largest first)
      const fileStats = await Promise.all(
        files.map(async filePath => {
          try {
            const stats = await fileManager.getFileStats(filePath);
            return { path: filePath, ...stats };
          } catch {
            return null;
          }
        })
      );

      const validFiles = fileStats.filter(Boolean).sort((a, b) => b!.size - a!.size);

      let deletedCount = 0;
      let totalFreed = 0;

      // Keep the most recent files, delete the rest if they're too large
      for (let i = keepCount; i < validFiles.length; i++) {
        const file = validFiles[i]!;
        if (file.size > maxSize) {
          await fileManager.deleteFile(file.path);
          deletedCount++;
          totalFreed += file.size;

          logger.debug('Large file deleted', {
            path: file.path,
            size: Math.round(file.size / 1024 / 1024), // MB
            maxSizeMB: Math.round(maxSize / 1024 / 1024)
          });
        }
      }

      logger.info('Large files cleanup completed', {
        directory,
        deletedCount,
        totalFreedMB: Math.round(totalFreed / 1024 / 1024)
      });
    } catch (error) {
      logger.error('Large files cleanup failed', error as Error, { directory });
    }
  }
}

// Export singleton instances for convenience
export const fileManager = new FileManager();
