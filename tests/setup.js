// Jest setup file

// Set test timeout
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NOTION_API_KEY = 'test-api-key';
process.env.NOTION_DATABASE_ID = 'test-database-id';

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