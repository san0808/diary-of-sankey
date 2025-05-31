// Test setup file for Jest
// This file runs before each test

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Mock console methods to avoid noise in test output
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Global test utilities
global.createMockNotionPage = (overrides = {}) => {
  return {
    id: 'test-page-id',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-01T00:00:00.000Z',
    properties: {
      Title: {
        title: [{ plain_text: 'Test Post' }]
      },
      Status: {
        select: { name: 'Published' }
      },
      Category: {
        select: { name: 'Blog' }
      },
      'Publish Date': {
        date: { start: '2024-01-01' }
      },
      Tags: {
        multi_select: [
          { name: 'test' },
          { name: 'jest' }
        ]
      },
      ...overrides
    }
  };
};

global.createMockNotionBlocks = () => {
  return [
    {
      id: 'block-1',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            plain_text: 'This is a test paragraph.',
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false
            }
          }
        ]
      }
    },
    {
      id: 'block-2',
      type: 'heading_1',
      heading_1: {
        rich_text: [
          {
            plain_text: 'Test Heading',
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false
            }
          }
        ]
      }
    }
  ];
};

// Mock date for consistent testing
const mockDate = new Date('2024-01-01T00:00:00.000Z');
global.Date = class extends Date {
  constructor(...args) {
    if (args.length === 0) {
      return mockDate;
    }
    return new (Function.prototype.bind.apply(Date, [null, ...args]))();
  }
  
  static now() {
    return mockDate.getTime();
  }
}; 