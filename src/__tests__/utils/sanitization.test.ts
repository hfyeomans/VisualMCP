import { sanitizeFilename, isSafeFilename } from '../../utils/sanitization.js';

describe('sanitization utilities', () => {
  describe('sanitizeFilename', () => {
    it('keeps safe filenames unchanged', () => {
      expect(sanitizeFilename('myfile.png')).toBe('myfile.png');
      expect(sanitizeFilename('report_2024.pdf')).toBe('report_2024.pdf');
      expect(sanitizeFilename('test-file.txt')).toBe('test-file.txt');
    });

    it('removes path separators to prevent directory traversal', () => {
      // path.basename extracts only the filename part
      expect(sanitizeFilename('../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('../../sensitive.txt')).toBe('sensitive.txt');
      expect(sanitizeFilename('/etc/hosts')).toBe('hosts');
      expect(sanitizeFilename('path/to/file.png')).toBe('file.png');
    });

    it('replaces dangerous characters with underscores', () => {
      // The sanitizer replaces special chars with underscores and collapses consecutive underscores
      expect(sanitizeFilename('file<>name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('test|file?.png')).toBe('test_file_.png');
      expect(sanitizeFilename('file*name:test.jpg')).toBe('file_name_test.jpg');
    });

    it('removes leading and trailing dots/spaces', () => {
      expect(sanitizeFilename('.hiddenfile')).toBe('hiddenfile');
      expect(sanitizeFilename('..file.txt')).toBe('file.txt');
      expect(sanitizeFilename('  file.png  ')).toBe('file.png');
      expect(sanitizeFilename('. . .file.txt')).toBe('file.txt');
    });

    it('collapses multiple spaces and underscores', () => {
      expect(sanitizeFilename('my    file.txt')).toBe('my_file.txt');
      expect(sanitizeFilename('test___file.png')).toBe('test_file.png');
      expect(sanitizeFilename('a  b  c.jpg')).toBe('a_b_c.jpg');
    });

    it('handles empty filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('   ')).toBe('unnamed');
      expect(sanitizeFilename('...')).toBe('unnamed');
    });

    it('truncates long filenames while preserving extension', () => {
      const longName = 'a'.repeat(300) + '.png';
      const result = sanitizeFilename(longName, { maxLength: 50 });

      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith('.png')).toBe(true);
    });

    it('validates and applies allowed extensions', () => {
      expect(
        sanitizeFilename('file.exe', {
          allowedExtensions: ['png', 'jpg'],
          defaultExtension: 'png'
        })
      ).toBe('file.png');

      expect(
        sanitizeFilename('image.jpg', {
          allowedExtensions: ['png', 'jpg'],
          defaultExtension: 'png'
        })
      ).toBe('image.jpg');
    });

    it('handles extensions with or without leading dot', () => {
      expect(
        sanitizeFilename('file.txt', {
          allowedExtensions: ['png'],
          defaultExtension: '.png'
        })
      ).toBe('file.png');

      expect(
        sanitizeFilename('file.txt', {
          allowedExtensions: ['png'],
          defaultExtension: 'png'
        })
      ).toBe('file.png');
    });
  });

  describe('isSafeFilename', () => {
    it('returns true for safe filenames', () => {
      expect(isSafeFilename('myfile.png')).toBe(true);
      expect(isSafeFilename('test_file.txt')).toBe(true);
      expect(isSafeFilename('report-2024.pdf')).toBe(true);
    });

    it('returns false for path traversal attempts', () => {
      expect(isSafeFilename('../file.txt')).toBe(false);
      expect(isSafeFilename('../../etc/passwd')).toBe(false);
      // Note: backslash path traversal only relevant on Windows
      if (process.platform === 'win32') {
        expect(isSafeFilename('..\\windows\\system32')).toBe(false);
      }
    });

    it('returns false for absolute paths', () => {
      expect(isSafeFilename('/etc/hosts')).toBe(false);
      // Windows paths are only relevant on Windows
      if (process.platform === 'win32') {
        expect(isSafeFilename('C:\\Windows\\System32')).toBe(false);
      }
    });

    it('returns false for filenames with null bytes', () => {
      expect(isSafeFilename('file\x00.txt')).toBe(false);
      expect(isSafeFilename('test\x00malicious')).toBe(false);
    });

    it('returns false for control characters', () => {
      expect(isSafeFilename('file\x01\x02.txt')).toBe(false);
      expect(isSafeFilename('test\x1fname.png')).toBe(false);
    });

    it('returns false when basename differs from original', () => {
      expect(isSafeFilename('dir/file.txt')).toBe(false);
      // Note: backslash is only a path separator on Windows
      // On Unix systems, it's a valid filename character
      if (process.platform === 'win32') {
        expect(isSafeFilename('path\\to\\file.png')).toBe(false);
      }
    });
  });
});
