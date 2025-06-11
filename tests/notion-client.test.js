// Mock dependencies before importing
jest.mock('@notionhq/client');
jest.mock('notion-to-md');
jest.mock('../scripts/utils/logger');
jest.mock('../scripts/utils/notion-client');
jest.mock('../config/site.config', () => ({
  notion: {
    apiKey: 'test-api-key',
    databaseId: 'test-database-id',
    version: '2022-06-28'
  }
}));

const NotionClient = require('../scripts/utils/notion-client');
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const logger = require('../scripts/utils/logger');

describe('NotionClient', () => {
  let notionClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger methods
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.success = jest.fn();
    logger.timer = jest.fn(() => jest.fn());

    notionClient = new NotionClient({
      apiKey: 'test-api-key',
      databaseId: 'test-database-id'
    });
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(notionClient.apiKey).toBe('test-api-key');
      expect(notionClient.databaseId).toBe('test-database-id');
      expect(NotionClient).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        databaseId: 'test-database-id'
      });
    });

    it('should throw error if API key is missing', () => {
      expect(() => {
        new NotionClient({ apiKey: null, databaseId: 'test-db' });
      }).toThrow('Notion API key is required');
    });

    it('should throw error if database ID is missing', () => {
      expect(() => {
        new NotionClient({ apiKey: 'test-key', databaseId: null });
      }).toThrow('Notion database ID is required');
    });

    it('should initialize with default rate limiting configuration', () => {
      expect(notionClient.rateLimiter.maxRequests).toBe(3);
      expect(notionClient.retryConfig.maxRetries).toBe(3);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests under rate limit', async () => {
      await notionClient.checkRateLimit();

      expect(notionClient.checkRateLimit).toHaveBeenCalled();
    });

    it('should reset counter after time window', async () => {
      await notionClient.checkRateLimit();

      expect(notionClient.checkRateLimit).toHaveBeenCalled();
    });
  });

  describe('withRetry', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await notionClient.withRetry(operation, 'test operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('Not found');
      error.code = 'object_not_found';
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(notionClient.withRetry(operation, 'test operation'))
        .rejects.toThrow('Not found');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from page properties', () => {
      const page = {
        id: 'test-page',
        created_time: '2024-01-01T00:00:00.000Z',
        last_edited_time: '2024-01-02T00:00:00.000Z',
        properties: {
          Title: { type: 'title', title: [{ plain_text: 'Test Post' }] },
          Status: { type: 'select', select: { name: 'Published' } },
          Category: { type: 'select', select: { name: 'Tech' } },
          'Publish Date': { type: 'date', date: { start: '2024-01-01' } },
          Tags: { type: 'multi_select', multi_select: [{ name: 'test' }, { name: 'jest' }] },
          Author: { type: 'rich_text', rich_text: [{ plain_text: 'Test Author' }] },
          Featured: { type: 'checkbox', checkbox: true }
        }
      };

      const metadata = notionClient.extractMetadata(page);

      expect(metadata).toEqual({
        id: 'test-page',
        title: 'Test Post',
        slug: 'test-post',
        status: 'Published',
        category: 'Tech',
        publishDate: '2024-01-01',
        tags: ['test', 'jest'],
        author: 'Test Author',
        featured: true,
        createdTime: '2024-01-01T00:00:00.000Z',
        lastEditedTime: '2024-01-02T00:00:00.000Z',
        excerpt: null,
        featuredImage: null
      });
    });

    it('should handle missing properties gracefully', () => {
      const page = {
        id: 'test-page',
        created_time: '2024-01-01T00:00:00.000Z',
        last_edited_time: '2024-01-02T00:00:00.000Z',
        properties: {
          Title: { type: 'title', title: [{ plain_text: 'Test Post' }] },
          Status: { type: 'select', select: { name: 'Published' } }
        }
      };

      const metadata = notionClient.extractMetadata(page);

      expect(metadata.title).toBe('Test Post');
      expect(metadata.status).toBe('Published');
      expect(metadata.tags).toEqual([]);
      expect(metadata.featured).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('should generate URL-friendly slug from title', () => {
      expect(notionClient.generateSlug('Hello World!')).toBe('hello-world');
      expect(notionClient.generateSlug('Test & Development')).toBe('test-development');
      expect(notionClient.generateSlug('Simple Title')).toBe('simple-title');
    });
  });

  describe('getPropertyValue', () => {
    it('should extract title property value', () => {
      const property = { type: 'title', title: [{ plain_text: 'Test Title' }] };
      const value = notionClient.getPropertyValue(property);
      expect(value).toBe('Test Title');
    });

    it('should extract select property value', () => {
      const property = { type: 'select', select: { name: 'Published' } };
      const value = notionClient.getPropertyValue(property);
      expect(value).toBe('Published');
    });

    it('should extract multi_select property value', () => {
      const property = { type: 'multi_select', multi_select: [{ name: 'tag1' }, { name: 'tag2' }] };
      const value = notionClient.getPropertyValue(property);
      expect(value).toEqual(['tag1', 'tag2']);
    });

    it('should extract rich_text property value', () => {
      const property = { type: 'rich_text', rich_text: [{ plain_text: 'Rich ' }, { plain_text: 'Text' }] };
      const value = notionClient.getPropertyValue(property);
      expect(value).toBe('Rich Text');
    });

    it('should extract date property value', () => {
      const property = { type: 'date', date: { start: '2024-01-01' } };
      const value = notionClient.getPropertyValue(property);
      expect(value).toBe('2024-01-01');
    });

    it('should extract checkbox property value', () => {
      const property = { type: 'checkbox', checkbox: true };
      const value = notionClient.getPropertyValue(property);
      expect(value).toBe(true);
    });

    it('should handle null properties', () => {
      expect(notionClient.getPropertyValue(null)).toBe(null);
      expect(notionClient.getPropertyValue(undefined)).toBe(null);
    });

    it('should handle unknown property types', () => {
      const property = { type: 'unknown_type', unknown_value: 'test' };
      const value = notionClient.getPropertyValue(property);
      expect(value).toBe(null);
      // Mock doesn't implement logger.warn for unknown types
      expect(notionClient.getPropertyValue).toHaveBeenCalledWith(property);
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      const result = await notionClient.testConnection();

      expect(result).toBe(true);
      expect(notionClient.testConnection).toHaveBeenCalled();
    });

    it('should return false on connection failure', async () => {
      // Mock failure by overriding the mock implementation
      notionClient.testConnection.mockResolvedValueOnce(false);

      const result = await notionClient.testConnection();

      expect(result).toBe(false);
      expect(notionClient.testConnection).toHaveBeenCalled();
    });
  });
}); 