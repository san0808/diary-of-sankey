const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  section: jest.fn(),
  timer: jest.fn(() => jest.fn()), // Return a mock function that can be called
  log: jest.fn()
};

module.exports = logger; 