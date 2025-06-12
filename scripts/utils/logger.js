const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { format } = require('date-fns');

/**
 * Logger utility for the blog system
 * Provides structured logging with colors, levels, and file output
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.enableFile = options.enableFile || false;
    this.logDir = options.logDir || 'logs';
    this.enableConsole = options.enableConsole !== false;
    
    // Log levels (higher number = more verbose)
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    // Color mapping for console output
    this.colors = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      debug: chalk.gray,
      trace: chalk.dim,
      success: chalk.green,
      highlight: chalk.cyan
    };

    // Ensure log directory exists if file logging is enabled
    if (this.enableFile) {
      fs.ensureDirSync(this.logDir);
    }
  }

  /**
   * Check if a log level should be output
   * @param {string} level - Log level to check
   * @returns {boolean}
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * Format a log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {string}
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const safeMeta = meta || {};
    const metaStr = Object.keys(safeMeta).length > 0 ? ` ${JSON.stringify(safeMeta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * Write log to file
   * @param {string} level - Log level
   * @param {string} message - Formatted message
   */
  async writeToFile(level, message) {
    if (!this.enableFile) return;

    // Ensure log directory exists
    await fs.ensureDir(this.logDir);

    const logFile = path.join(this.logDir, `${format(new Date(), 'yyyy-MM-dd')}.log`);
    const errorLogFile = path.join(this.logDir, 'error.log');

    try {
      await fs.appendFile(logFile, message + '\n');
      
      // Also write errors to separate error log
      if (level === 'error') {
        await fs.appendFile(errorLogFile, message + '\n');
      }
    } catch (err) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', err.message);
    }
  }

  /**
   * Core logging method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    // Console output with colors
    if (this.enableConsole) {
      const colorFn = this.colors[level] || ((x) => x);
      console.log(colorFn(formattedMessage));
    }

    // File output
    await this.writeToFile(level, formattedMessage);
  }

  /**
   * Error logging
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or metadata
   */
  async error(message, error = {}) {
    const meta = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : error;
    
    await this.log('error', message, meta);
  }

  /**
   * Warning logging
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  async warn(message, meta = {}) {
    await this.log('warn', message, meta);
  }

  /**
   * Info logging
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  async info(message, meta = {}) {
    await this.log('info', message, meta);
  }

  /**
   * Debug logging
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  async debug(message, meta = {}) {
    await this.log('debug', message, meta);
  }

  /**
   * Trace logging
   * @param {string} message - Trace message
   * @param {Object} meta - Additional metadata
   */
  async trace(message, meta = {}) {
    await this.log('trace', message, meta);
  }

  /**
   * Success logging (info level with green color)
   * @param {string} message - Success message
   * @param {Object} meta - Additional metadata
   */
  async success(message, meta = {}) {
    if (!this.shouldLog('info')) return;

    const formattedMessage = this.formatMessage('info', message, meta);

    if (this.enableConsole) {
      console.log(this.colors.success(formattedMessage));
    }

    await this.writeToFile('info', formattedMessage);
  }

  /**
   * Highlighted info logging
   * @param {string} message - Message to highlight
   * @param {Object} meta - Additional metadata
   */
  async highlight(message, meta = {}) {
    if (!this.shouldLog('info')) return;

    const formattedMessage = this.formatMessage('info', message, meta);

    if (this.enableConsole) {
      console.log(this.colors.highlight(formattedMessage));
    }

    await this.writeToFile('info', formattedMessage);
  }

  /**
   * Create a timer for measuring operation duration
   * @param {string} operation - Operation name
   * @returns {Function} End timer function
   */
  timer(operation) {
    const start = Date.now();
    this.debug(`Started: ${operation}`);

    return () => {
      const duration = Date.now() - start;
      this.info(`Completed: ${operation}`, { duration: `${duration}ms` });
      return duration;
    };
  }

  /**
   * Log a section separator
   * @param {string} title - Section title
   */
  section(title) {
    if (!this.shouldLog('info')) return;

    const separator = '='.repeat(50);
    const centeredTitle = title.length < 46 
      ? title.padStart((46 + title.length) / 2).padEnd(46)
      : title.substring(0, 46);

    if (this.enableConsole) {
      console.log(chalk.bold.blue(`\n${separator}`));
      console.log(chalk.bold.blue(`  ${centeredTitle}  `));
      console.log(chalk.bold.blue(`${separator}\n`));
    }
  }

  /**
   * Clean old log files (keep last N days)
   * @param {number} daysToKeep - Number of days to keep
   */
  async cleanOldLogs(daysToKeep = 30) {
    if (!this.enableFile) return;

    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.match(/^\d{4}-\d{2}-\d{2}\.log$/)) {
          const fileDate = new Date(file.replace('.log', ''));
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.logDir, file));
            this.debug(`Cleaned old log file: ${file}`);
          }
        }
      }
    } catch (err) {
      this.error('Failed to clean old logs', err);
    }
  }
}

// Create singleton instance
const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableFile: process.env.NODE_ENV === 'production',
  enableConsole: true
});

module.exports = logger; 