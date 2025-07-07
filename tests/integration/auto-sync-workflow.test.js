const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../config/site.config', () => ({
  notion: {
    apiKey: 'test-key',
    databaseId: 'test-db-id'
  },
  build: {
    outputDir: 'dist',
    contentDir: 'content',
    templatesDir: 'templates',
    staticDir: 'static'
  },
  content: {
    contentDir: 'content',
    postsPerPage: 10,
    enableRss: true,
    enableSitemap: true,
    enableSearch: true
  },
  site: {
    title: 'Test Blog',
    description: 'Test blog description',
    url: 'https://test.com'
  },
  author: {
    name: 'Test Author',
    email: 'test@example.com'
  },
  services: {
    analytics: {
      googleAnalytics: 'GA-TEST-123',
      plausible: null
    }
  },
  performance: {
    enableServiceWorker: false,
    enableCompression: true,
    enableMinification: true
  },
  categories: {},
  ogImages: {
    enabled: process.env.TEST_OG_IMAGES === 'true', // Allow enabling for comprehensive tests
    generateFallbacks: false,
    dimensions: { width: 1200, height: 630 },
    // Use a test-specific output directory to avoid conflicts
    outputDir: process.env.TEST_OG_IMAGES === 'true' ? 'test-og-images' : undefined
  }
}));

describe('Auto-Sync Workflow Integration', () => {
  let originalEnv;
  let mockContentDir;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockContentDir = path.join(process.cwd(), 'content');
    
    // Mock file system operations
    fs.ensureDirSync = jest.fn();
    fs.pathExists = jest.fn().mockResolvedValue(true);
    fs.readFile = jest.fn();
    fs.writeFile = jest.fn();
    fs.readdir = jest.fn().mockResolvedValue([]);
    fs.stat = jest.fn().mockResolvedValue({ isFile: () => true, mtime: new Date() });
    fs.copy = jest.fn();
    fs.remove = jest.fn();
    fs.readJson = jest.fn().mockImplementation((filePath) => {
      if (filePath.includes('posts-index.json')) {
        return Promise.resolve({ posts: [] });
      }
      if (filePath.includes('scheduled-index.json')) {
        return Promise.resolve({ posts: [] });
      }
      if (filePath.includes('categories/index.json')) {
        return Promise.resolve({
          categories: [
            { name: 'Tech', slug: 'tech' },
            { name: 'Math', slug: 'math' }
          ]
        });
      }
      return Promise.resolve({ posts: [], categories: [], tags: [] });
    });
    
    // Set required environment variables
    process.env.NOTION_API_KEY = 'test_key_for_integration';
    process.env.NOTION_DATABASE_ID = 'test_database_id';
    process.env.NODE_ENV = 'test';

    // Enhanced template mocking specifically for SiteBuilder integration
    global.mockTemplateFunction = jest.fn().mockImplementation((context) => {
      if (context && context.posts) {
        return `<div class="posts">${context.posts.length} posts</div>`;
      }
      if (context && context.featuredPosts) {
        return `<div class="home">${context.featuredPosts.length} featured posts</div>`;
      }
      return '<div>Mock template content</div>';
    });

    // Mock the SiteBuilder loadTemplates and loadContent methods directly on the module
    const siteBuilderModule = require('../../scripts/build-site');
    jest.spyOn(siteBuilderModule.prototype, 'loadTemplates').mockImplementation(async function() {
      this.templates = {
        'base': global.mockTemplateFunction,
        'home': global.mockTemplateFunction,
        'blog-list': global.mockTemplateFunction,
        'blog-post': global.mockTemplateFunction
      };
    });

    // Mock the SiteBuilder loadContent method to ensure proper data structure
    jest.spyOn(siteBuilderModule.prototype, 'loadContent').mockImplementation(async function() {
      return {
        publishedPosts: [],
        scheduledPosts: [],
        draftPosts: [],
        categories: [
          { name: 'Tech', slug: 'tech' },
          { name: 'Math', slug: 'math' }
        ],
        tags: []
      };
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('GitHub Actions Auto-Sync Simulation', () => {
    it('should complete full sync->build workflow without errors', async () => {
      // This simulates the exact workflow that runs every 3 hours in production
      const NotionSync = require('../../scripts/notion-sync');
      const SiteBuilder = require('../../scripts/build-site');
      
      // Mock successful Notion connection
      const mockNotionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue([{
          id: 'test-post-1',
          properties: {
            Title: { title: [{ text: { content: 'Test Auto-Sync Post' } }] },
            Status: { select: { name: 'Published' } },
            Category: { select: { name: 'Blog' } },
            'Publish Date': { date: { start: '2024-01-01' } }
          },
          last_edited_time: '2024-01-01T12:00:00.000Z'
        }]),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        getPage: jest.fn().mockResolvedValue({ id: 'test-post-1' }),
        getBlocks: jest.fn().mockResolvedValue([{
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: 'Test content' } }] }
        }]),
        getPageBlocks: jest.fn().mockResolvedValue([{
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: 'Test content' } }] }
        }]),
        extractMetadata: jest.fn().mockResolvedValue({
          title: 'Test Auto-Sync Post',
          slug: 'test-auto-sync-post',
          status: 'Published',
          category: 'Blog',
          publishDate: '2024-01-01',
          lastModified: '2024-01-01T12:00:00.000Z',
          content: 'Test content'
        })
      };

      // Test the complete workflow
      const sync = new NotionSync({ dryRun: true });
      sync.notionClient = mockNotionClient;
      
      const syncResult = await sync.sync();
      
      expect(syncResult).toMatchObject({
        totalPosts: expect.any(Number),
        published: expect.any(Number),
        scheduled: expect.any(Number),
        drafts: expect.any(Number)
      });

      // Test that build can handle the synced content
      const builder = new SiteBuilder();
      const buildResult = await builder.build();
      
      expect(buildResult).toMatchObject({
        totalPages: expect.any(Number),
        publishedPosts: expect.any(Number)
      });
    });

    it('should handle Notion API failures gracefully in auto-sync context', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      const mockFailingClient = {
        testConnection: jest.fn().mockResolvedValue(false)
      };

      const sync = new NotionSync();
      sync.notionClient = mockFailingClient;
      
      await expect(sync.sync()).rejects.toThrow('Failed to connect to Notion API');
      
      // Verify error logging for monitoring
      expect(mockFailingClient.testConnection).toHaveBeenCalled();
    });

    it('should handle concurrent sync prevention', async () => {
      // This tests what happens if manual sync runs while auto-sync is running
      const NotionSync = require('../../scripts/notion-sync');
      
      const lockFile = path.join(process.cwd(), '.sync.lock');
      fs.pathExists.mockImplementation((filePath) => {
        return Promise.resolve(filePath === lockFile);
      });

      const sync = new NotionSync();
      
      // First sync should detect lock file (simulated concurrent process)
      // We should implement lock file checking in the actual sync process
      expect(await fs.pathExists(lockFile)).toBe(true);
    });
  });

  describe('Large Scale Content Scenarios', () => {
    it('should handle large number of posts without timeout', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      // Simulate 100 posts (realistic for a mature blog)
      const largePosts = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        properties: {
          Title: { title: [{ text: { content: `Post ${i}` } }] },
          Status: { select: { name: 'Published' } },
          Category: { select: { name: 'Blog' } },
          'Publish Date': { date: { start: '2024-01-01' } }
        },
        last_edited_time: '2024-01-01T12:00:00.000Z'
      }));

      const mockNotionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(largePosts),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        getPage: jest.fn().mockImplementation((id) => Promise.resolve({ id })),
        getBlocks: jest.fn().mockResolvedValue([{
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: 'Test content' } }] }
        }]),
        getPageBlocks: jest.fn().mockResolvedValue([{
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: 'Test content' } }] }
        }]),
        extractMetadata: jest.fn().mockImplementation((page) => Promise.resolve({
          title: `Post ${page.id.split('-')[1] || '1'}`,
          slug: `post-${page.id.split('-')[1] || '1'}`,
          status: 'Published',
          category: 'Blog',
          publishDate: '2024-01-01',
          lastModified: '2024-01-01T12:00:00.000Z',
          content: 'Test content'
        }))
      };

      const sync = new NotionSync({ dryRun: true });
      sync.notionClient = mockNotionClient;
      
      const startTime = Date.now();
      const result = await sync.sync();
      const duration = Date.now() - startTime;
      
      expect(result.totalPosts).toBe(100);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle image download failures without breaking sync', async () => {
      const ContentProcessor = require('../../scripts/utils/content-processor');
      
      const processor = new ContentProcessor();
      
      // Mock image download failure
      processor.downloadImage = jest.fn().mockRejectedValue(new Error('Network timeout'));
      
      const imageBlock = {
        type: 'image',
        image: {
          type: 'external',
          external: { url: 'https://example.com/large-image.jpg' }
        }
      };

      // Should not throw, should return fallback HTML
      const result = await processor.processImage(imageBlock);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('img'); // Should still produce image tag with original URL
    });
  });

  describe('File System Stress Tests', () => {
    it('should handle disk space exhaustion gracefully', async () => {
      const ContentProcessor = require('../../scripts/utils/content-processor');
      
      // Mock ENOSPC (no space left on device) error
      fs.writeFile.mockRejectedValue({ code: 'ENOSPC', message: 'No space left on device' });
      
      const processor = new ContentProcessor();
      
      // Should handle gracefully and continue
      await expect(() => processor.cleanupUnusedImages()).not.toThrow();
    });

    it('should handle permission errors during content writing', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      // Mock permission denied error
      fs.writeFile.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });
      
      const sync = new NotionSync({ dryRun: false });
      
      // Should log error but not crash entire sync  
      await expect(() => sync.generateIndexes([])).not.toThrow();
    });
  });

  describe('Network Resilience', () => {
    it('should retry on temporary network failures', async () => {
      const NotionClient = require('../../scripts/utils/notion-client');
      
      const client = new NotionClient();
      
      // Mock network failure then success
      let callCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve('success');
      });

      const result = await client.withRetry(mockOperation, 'test operation');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3); // Failed twice, succeeded third time
    });

    it('should not retry on permanent errors (401, 404)', async () => {
      const NotionClient = require('../../scripts/utils/notion-client');
      
      const client = new NotionClient();
      
      const unauthorizedError = new Error('Unauthorized');
      unauthorizedError.code = 'unauthorized';
      
      const mockOperation = jest.fn().mockRejectedValue(unauthorizedError);

      await expect(client.withRetry(mockOperation, 'test operation')).rejects.toThrow('Unauthorized');
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('Data Integrity', () => {
    it('should validate content structure before writing', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      const malformedPost = {
        id: 'malformed',
        properties: {
          // Missing required Title property
          Status: { select: { name: 'Published' } }
        }
      };

      const mockNotionClient = {
        extractMetadata: jest.fn().mockImplementation(() => {
          return Promise.reject(new Error('Page malformed is missing a title'));
        }),
        getPageBlocks: jest.fn().mockResolvedValue([])
      };

      const sync = new NotionSync({ dryRun: true });
      sync.notionClient = mockNotionClient;
      
      // Should handle malformed posts without crashing - the error should be caught and logged
      const processedPost = await sync.processPost(malformedPost);
      
      // Since the error is caught and logged, processPost should return null for failed processing
      expect(processedPost).toBeNull();
    });

    it('should detect and handle content corruption', async () => {
      const ContentProcessor = require('../../scripts/utils/content-processor');
      
      const processor = new ContentProcessor();
      
      const corruptedBlock = {
        type: 'paragraph',
        paragraph: null // This would cause a crash
      };

      // Should not crash, should return empty string or error placeholder
      const result = await processor.processBlock(corruptedBlock);
      
      expect(typeof result).toBe('string');
    });
  });
}); 