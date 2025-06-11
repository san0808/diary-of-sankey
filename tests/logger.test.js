const Logger = require('../scripts/utils/logger');
const fs = require('fs-extra');
const chalk = require('chalk');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('chalk');

describe('Logger', () => {
  let logger;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Mock chalk colors
    chalk.red = jest.fn().mockImplementation((text) => `RED(${text})`);
    chalk.yellow = jest.fn().mockImplementation((text) => `YELLOW(${text})`);
    chalk.blue = jest.fn().mockImplementation((text) => `BLUE(${text})`);
    chalk.gray = jest.fn().mockImplementation((text) => `GRAY(${text})`);
    chalk.dim = jest.fn().mockImplementation((text) => `DIM(${text})`);
    chalk.green = jest.fn().mockImplementation((text) => `GREEN(${text})`);
    chalk.cyan = jest.fn().mockImplementation((text) => `CYAN(${text})`);

    // Mock fs-extra
    fs.ensureDirSync = jest.fn();
    fs.appendFile = jest.fn().mockResolvedValue();
    fs.readdir = jest.fn().mockResolvedValue([]);
    fs.stat = jest.fn().mockResolvedValue({
      isFile: () => true,
      birthtime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 days old
    });
    fs.unlink = jest.fn().mockResolvedValue();

    logger = new Logger();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const logger = new Logger();
      expect(logger.level).toBe('info');
      expect(logger.enableFile).toBe(false);
      expect(logger.enableConsole).toBe(true);
      expect(logger.logDir).toBe('logs');
    });

    it('should initialize with custom options', () => {
      const logger = new Logger({
        level: 'debug',
        enableFile: true,
        logDir: 'custom-logs',
        enableConsole: false
      });
      expect(logger.level).toBe('debug');
      expect(logger.enableFile).toBe(true);
      expect(logger.logDir).toBe('custom-logs');
      expect(logger.enableConsole).toBe(false);
    });

    it('should read log level from environment', () => {
      process.env.LOG_LEVEL = 'trace';
      const logger = new Logger();
      expect(logger.level).toBe('trace');
      delete process.env.LOG_LEVEL;
    });

    it('should create log directory when file logging is enabled', () => {
      new Logger({ enableFile: true });
      expect(fs.ensureDirSync).toHaveBeenCalledWith('logs');
    });

    it('should not create log directory when file logging is disabled', () => {
      new Logger({ enableFile: false });
      expect(fs.ensureDirSync).not.toHaveBeenCalled();
    });
  });

  describe('shouldLog', () => {
    it('should return true for logs at or below the current level', () => {
      const logger = new Logger({ level: 'info' });
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('trace')).toBe(false);
    });

    it('should work with debug level', () => {
      const logger = new Logger({ level: 'debug' });
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
      logger = new Logger({ enableFile: true });
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
      const logger = new Logger({ enableFile: false });

      await logger.writeToFile('info', 'Test message');

      expect(fs.appendFile).not.toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should not log if level is too high', async () => {
      const logger = new Logger({ level: 'warn' });

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
      const logger = new Logger({ enableConsole: false });

      await logger.log('info', 'Test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should write to file when enabled', async () => {
      const logger = new Logger({ enableFile: true });

      await logger.log('info', 'Test message');

      expect(fs.appendFile).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error with Error object', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      await logger.error('Something went wrong', error);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('RED(')
      );
    });

    it('should log error with metadata object', async () => {
      const meta = { code: 'E001', severity: 'high' };

      await logger.error('Database error', meta);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"code":"E001","severity":"high"}')
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
      const logger = new Logger({ level: 'debug' });

      await logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRAY(')
      );
    });

    it('should not log debug when level is higher', async () => {
      const logger = new Logger({ level: 'info' });

      await logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('trace', () => {
    it('should log trace with dim color when enabled', async () => {
      const logger = new Logger({ level: 'trace' });

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
      const logger = new Logger({ enableFile: true });

      await logger.success('Success message');

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.log$/),
        expect.stringContaining('[INFO]')
      );
    });

    it('should not log success when info level is disabled', async () => {
      const logger = new Logger({ level: 'warn' });

      await logger.success('Success message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('highlight', () => {
    it('should log highlighted message with cyan color', async () => {
      await logger.highlight('Important message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN(')
      );
    });

    it('should write to file as info level', async () => {
      const logger = new Logger({ enableFile: true });

      await logger.highlight('Important message');

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.log$/),
        expect.stringContaining('[INFO]')
      );
    });
  });

  describe('timer', () => {
    it('should return timer function that logs duration', async () => {
      const logger = new Logger({ level: 'debug' });
      
      const endTimer = logger.timer('Test operation');
      
      // Wait a bit to ensure some time passes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      endTimer();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed: Test operation')
      );
    });

    it('should log start message at debug level', () => {
      const logger = new Logger({ level: 'debug' });
      
      logger.timer('Test operation');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Started: Test operation')
      );
    });

    it('should not log when debug level is disabled', () => {
      const logger = new Logger({ level: 'info' });
      
      const endTimer = logger.timer('Test operation');
      endTimer();

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('section', () => {
    it('should log section header with decorative formatting', () => {
      logger.section('Test Section');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('==================================================')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test Section')
      );
    });
  });

  describe('cleanOldLogs', () => {
    beforeEach(() => {
      logger = new Logger({ enableFile: true });
    });

    it('should remove old log files', async () => {
      fs.readdir.mockResolvedValue(['2024-01-01.log', '2024-01-02.log', 'error.log']);
      
      await logger.cleanOldLogs(30);

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('2024-01-01.log')
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('2024-01-02.log')
      );
      expect(fs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('error.log')
      );
    });

    it('should handle errors when deleting files', async () => {
      fs.readdir.mockResolvedValue(['old.log']);
      fs.unlink.mockRejectedValue(new Error('Permission denied'));

      await logger.cleanOldLogs();

      expect(fs.unlink).toHaveBeenCalled();
      // Should not throw error
    });

    it('should skip non-log files', async () => {
      fs.readdir.mockResolvedValue(['config.json', '2024-01-01.log', 'readme.txt']);
      fs.stat.mockImplementation((path) => {
        if (path.includes('config.json') || path.includes('readme.txt')) {
          return Promise.resolve({
            isFile: () => false,
            birthtime: new Date()
          });
        }
        return Promise.resolve({
          isFile: () => true,
          birthtime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
        });
      });

      await logger.cleanOldLogs(30);

      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('2024-01-01.log')
      );
    });

    it('should handle readdir errors', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory not found'));

      await logger.cleanOldLogs();

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle stat errors', async () => {
      fs.readdir.mockResolvedValue(['test.log']);
      fs.stat.mockRejectedValue(new Error('Stat failed'));

      await logger.cleanOldLogs();

      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('color handling', () => {
    it('should use default identity function for unknown levels', async () => {
      await logger.log('unknown', 'Test message');

      // Should still log but without color function
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata gracefully', async () => {
      await logger.error('Error message', null);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Error message')
      );
    });

    it('should handle undefined metadata gracefully', async () => {
      await logger.warn('Warning message', undefined);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Warning message')
      );
    });

    it('should handle very large metadata objects', async () => {
      const largeMeta = {
        data: new Array(1000).fill('x').join(''),
        nested: {
          deep: {
            object: 'value'
          }
        }
      };

      await logger.info('Message with large meta', largeMeta);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
}); 