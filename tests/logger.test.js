const fs = require('fs-extra');

// Mock dependencies before requiring logger
jest.mock('fs-extra');
jest.mock('chalk', () => ({
  red: jest.fn().mockImplementation((text) => `RED(${text})`),
  yellow: jest.fn().mockImplementation((text) => `YELLOW(${text})`),
  blue: jest.fn().mockImplementation((text) => `BLUE(${text})`),
  gray: jest.fn().mockImplementation((text) => `GRAY(${text})`),
  dim: jest.fn().mockImplementation((text) => `DIM(${text})`),
  green: jest.fn().mockImplementation((text) => `GREEN(${text})`),
  cyan: jest.fn().mockImplementation((text) => `CYAN(${text})`),
  bold: {
    blue: jest.fn().mockImplementation((text) => `BOLD_BLUE(${text})`)
  }
}));

const logger = require('../scripts/utils/logger');

describe('Logger', () => {
  let consoleLogSpy;
  let originalLevel;
  let originalEnableFile;
  let originalEnableConsole;
  let originalLogDir;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original values
    originalLevel = logger.level;
    originalEnableFile = logger.enableFile;
    originalEnableConsole = logger.enableConsole;
    originalLogDir = logger.logDir;
    
    // Reset to default values for testing
    logger.level = 'info';
    logger.enableFile = false;
    logger.enableConsole = true;
    logger.logDir = 'logs';
    
    // Mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();



    // Mock fs-extra
    fs.ensureDirSync = jest.fn();
    fs.appendFile = jest.fn().mockResolvedValue();
    fs.readdir = jest.fn().mockResolvedValue([]);
    fs.stat = jest.fn().mockResolvedValue({
      isFile: () => true,
      birthtime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 days old
    });
    fs.unlink = jest.fn().mockResolvedValue();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    
    // Restore original values
    logger.level = originalLevel;
    logger.enableFile = originalEnableFile;
    logger.enableConsole = originalEnableConsole;
    logger.logDir = originalLogDir;
  });

  describe('instance properties', () => {
    it('should have default properties set', () => {
      expect(logger.level).toBeDefined();
      expect(logger.enableFile).toBeDefined();
      expect(logger.enableConsole).toBeDefined();
      expect(logger.logDir).toBeDefined();
      expect(logger.levels).toBeDefined();
      expect(logger.colors).toBeDefined();
    });

    it('should have proper log levels defined', () => {
      expect(logger.levels.error).toBe(0);
      expect(logger.levels.warn).toBe(1);
      expect(logger.levels.info).toBe(2);
      expect(logger.levels.debug).toBe(3);
      expect(logger.levels.trace).toBe(4);
    });
  });

  describe('shouldLog', () => {
    it('should return true for logs at or below the current level', () => {
      logger.level = 'info';
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('trace')).toBe(false);
    });

    it('should work with debug level', () => {
      logger.level = 'debug';
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(true);
      expect(logger.shouldLog('trace')).toBe(false);
    });
  });

  describe('formatMessage', () => {
    it('should format message with timestamp and level', () => {
      const message = logger.formatMessage('info', 'Test message');
      expect(message).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] Test message/);
    });

    it('should include metadata when provided', () => {
      const meta = { userId: 123, action: 'login' };
      const message = logger.formatMessage('info', 'User action', meta);
      expect(message).toContain('{"userId":123,"action":"login"}');
    });

    it('should handle empty metadata', () => {
      const message = logger.formatMessage('info', 'Test message', {});
      expect(message).not.toContain('{}');
      expect(message).toMatch(/\[INFO\] Test message$/);
    });
  });

  describe('writeToFile', () => {
    beforeEach(() => {
      logger.enableFile = true;
    });

    it('should write to daily log file', async () => {
      await logger.writeToFile('info', 'Test message');

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringMatching(/logs\/\d{4}-\d{2}-\d{2}\.log$/),
        'Test message\n'
      );
    });

    it('should write errors to separate error log', async () => {
      await logger.writeToFile('error', 'Error message');

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        'Error message\n'
      );
    });

    it('should handle file write errors gracefully', async () => {
      fs.appendFile.mockRejectedValue(new Error('File write failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await logger.writeToFile('info', 'Test message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to write to log file:',
        'File write failed'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not write to file when file logging is disabled', async () => {
      logger.enableFile = false;

      await logger.writeToFile('info', 'Test message');

      expect(fs.appendFile).not.toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should not log if level is too high', async () => {
      logger.level = 'warn';

      await logger.log('debug', 'Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log to console with colors', async () => {
      await logger.log('error', 'Error message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('RED(')
      );
    });

    it('should not log to console when disabled', async () => {
      logger.enableConsole = false;

      await logger.log('info', 'Test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should write to file when enabled', async () => {
      logger.enableFile = true;

      await logger.log('info', 'Test message');

      expect(fs.appendFile).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error with Error object', async () => {
      const error = new Error('Test error');
      
      await logger.error('Something went wrong', error);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong')
      );
    });

    it('should log error with metadata object', async () => {
      const meta = { userId: 123, operation: 'save' };
      
      await logger.error('Operation failed', meta);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed')
      );
    });
  });

  describe('warn', () => {
    it('should log warning with yellow color', async () => {
      await logger.warn('Warning message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW(')
      );
    });
  });

  describe('info', () => {
    it('should log info with blue color', async () => {
      await logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLUE(')
      );
    });
  });

  describe('debug', () => {
    it('should log debug with gray color when enabled', async () => {
      logger.level = 'debug';
      
      await logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRAY(')
      );
    });

    it('should not log debug when level is higher', async () => {
      logger.level = 'info';
      
      await logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('trace', () => {
    it('should log trace with dim color when enabled', async () => {
      logger.level = 'trace';
      
      await logger.trace('Trace message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DIM(')
      );
    });
  });

  describe('success', () => {
    it('should log success with green color', async () => {
      await logger.success('Success message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('GREEN(')
      );
    });

    it('should write to file as info level', async () => {
      logger.enableFile = true;
      
      await logger.success('Success message');

      expect(fs.appendFile).toHaveBeenCalled();
    });

    it('should not log success when info level is disabled', async () => {
      logger.level = 'warn';
      
      await logger.success('Success message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('highlight', () => {
    it('should log highlighted message with cyan color', async () => {
      await logger.highlight('Highlighted message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN(')
      );
    });

    it('should write to file as info level', async () => {
      logger.enableFile = true;
      
      await logger.highlight('Highlighted message');

      expect(fs.appendFile).toHaveBeenCalled();
    });
  });

  describe('timer', () => {
    it('should return timer function that logs duration', (done) => {
      logger.level = 'debug';
      const endTimer = logger.timer('test operation');
      
      expect(typeof endTimer).toBe('function');
      
      // Wait a bit then end timer
      setTimeout(() => {
        const duration = endTimer();
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThan(0);
        done();
      }, 10);
    });

    it('should log start message at debug level', async () => {
      logger.level = 'debug';
      
      logger.timer('test operation');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Started: test operation')
      );
    });

    it('should not log when debug level is disabled', async () => {
      logger.level = 'info';
      
      logger.timer('test operation');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('section', () => {
    it('should log section header with decorative formatting', () => {
      logger.section('Test Section');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('BOLD_BLUE(')
      );
    });
  });

  describe('cleanOldLogs', () => {
    beforeEach(() => {
      logger.enableFile = true;
    });

    it('should remove old log files', async () => {
      fs.readdir.mockResolvedValue(['2023-01-01.log', '2023-01-02.log']);
      
      await logger.cleanOldLogs(1);

      expect(fs.readdir).toHaveBeenCalledWith('logs');
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when deleting files', async () => {
      fs.readdir.mockResolvedValue(['2023-01-01.log']);
      fs.unlink.mockRejectedValue(new Error('Delete failed'));
      
      await logger.cleanOldLogs(1);

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should skip non-log files', async () => {
      fs.readdir.mockResolvedValue(['not-a-log.txt', '2023-01-01.log']);
      
      await logger.cleanOldLogs(1);

      expect(fs.unlink).toHaveBeenCalledTimes(1);
    });

    it('should handle readdir errors', async () => {
      fs.readdir.mockRejectedValue(new Error('Read failed'));
      
      await logger.cleanOldLogs(1);

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle stat errors', async () => {
      fs.readdir.mockResolvedValue(['2023-01-01.log']);
      fs.stat.mockRejectedValue(new Error('Stat failed'));
      
      await logger.cleanOldLogs(1);

      // Should still attempt to delete based on filename date
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('color handling', () => {
    it('should use default identity function for unknown levels', async () => {
      // Unknown level should be treated as if it's allowed (no level check for unknown)
      // But since it's not in the levels object, shouldLog will return false 
      logger.levels['unknown'] = 2; // Make it valid for this test
      
      await logger.log('unknown', 'Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UNKNOWN] Test message')
      );
      
      // Clean up
      delete logger.levels['unknown'];
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata gracefully', () => {
      const message = logger.formatMessage('info', 'Test message', null);
      expect(message).toMatch(/\[INFO\] Test message$/);
    });

    it('should handle undefined metadata gracefully', () => {
      const message = logger.formatMessage('info', 'Test message', undefined);
      expect(message).toMatch(/\[INFO\] Test message$/);
    });

    it('should handle very large metadata objects', () => {
      const largeMeta = {};
      for (let i = 0; i < 1000; i++) {
        largeMeta[`key${i}`] = `value${i}`;
      }
      
      const message = logger.formatMessage('info', 'Test message', largeMeta);
      expect(message).toContain('[INFO] Test message');
      expect(message).toContain('key0');
    });
  });
}); 