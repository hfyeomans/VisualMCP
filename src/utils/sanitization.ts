import path from 'path';

/**
 * Sanitize a filename to prevent path traversal and invalid characters
 *
 * @param filename - The filename to sanitize
 * @param options - Sanitization options
 * @returns A safe filename suitable for filesystem use
 */
export function sanitizeFilename(
  filename: string,
  options: {
    maxLength?: number;
    allowedExtensions?: string[];
    defaultExtension?: string;
  } = {}
): string {
  const { maxLength = 255, allowedExtensions, defaultExtension } = options;

  // Remove any path components (prevent directory traversal)
  let safe = path.basename(filename);

  // Remove or replace dangerous characters
  // Allow: alphanumeric, dash, underscore, dot, space
  safe = safe.replace(/[^a-zA-Z0-9._\-\s]/g, '_');

  // Remove leading/trailing dots and spaces
  safe = safe.replace(/^[\s.]+|[\s.]+$/g, '');

  // Collapse multiple spaces/underscores
  safe = safe.replace(/[\s_]+/g, '_');

  // Ensure filename is not empty
  if (safe.length === 0) {
    safe = 'unnamed';
  }

  // Extract extension
  const ext = path.extname(safe).toLowerCase();
  const nameWithoutExt = safe.slice(0, safe.length - ext.length);

  // Validate extension if allowedExtensions provided
  if (allowedExtensions && allowedExtensions.length > 0) {
    const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext;
    if (!allowedExtensions.includes(normalizedExt)) {
      // Use default extension if provided, otherwise keep as-is
      if (defaultExtension) {
        const finalExt = defaultExtension.startsWith('.')
          ? defaultExtension
          : `.${defaultExtension}`;
        safe = nameWithoutExt + finalExt;
      }
    }
  }

  // Truncate to max length (preserve extension)
  if (safe.length > maxLength) {
    const currentExt = path.extname(safe);
    const maxNameLength = maxLength - currentExt.length;
    safe = safe.slice(0, maxNameLength) + currentExt;
  }

  return safe;
}

/**
 * Check if a filename is safe (doesn't contain path traversal or invalid characters)
 *
 * @param filename - The filename to check
 * @returns True if the filename is safe, false otherwise
 */
export function isSafeFilename(filename: string): boolean {
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes(path.sep)) {
    return false;
  }

  // Check for null bytes or control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(filename)) {
    return false;
  }

  // Check if basename matches original (no path components)
  if (path.basename(filename) !== filename) {
    return false;
  }

  return true;
}
