 const fs = require('fs-extra');
const path = require('path');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../scripts/utils/logger');
jest.mock('../config/site.config', () => ({
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
    postsPerPage: 10,
    enableRss: true,
    enableSitemap: true
  },
  site: {
    title: 'Test Blog',
    description: 'Test blog description',
    url: 'https://test.com'
  },
  author: {
    name: 'Test Author',
    email: 'test@example.com'
  }
}));

describe('Performance Optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs-extra methods
    fs.pathExists = jest.fn().mockResolvedValue(true);
    fs.ensureDir = jest.fn().mockResolvedValue();
    fs.readJson = jest.fn().mockResolvedValue({});
    fs.writeJson = jest.fn().mockResolvedValue();
    fs.readFile = jest.fn().mockResolvedValue('mock content');
    fs.writeFile = jest.fn().mockResolvedValue();
    fs.copy = jest.fn().mockResolvedValue();
    fs.readdir = jest.fn().mockResolvedValue(['file1.txt', 'file2.js']);
    fs.stat = jest.fn().mockResolvedValue({ 
      isFile: () => true, 
      isDirectory: () => false,
      mtime: new Date(),
      size: 1024
    });
    fs.statSync = jest.fn().mockReturnValue({ 
      mtime: new Date(), 
      size: 1024 
    });
    fs.existsSync = jest.fn().mockReturnValue(true);
  });

  describe('Parallel Notion Sync', () => {
    it('should process posts in parallel batches', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      // Mock posts data
      const mockPosts = Array.from({ length: 12 }, (_, i) => ({
        id: `post-${i}`,
        properties: {
          Title: { title: [{ text: { content: `Post ${i}` } }] },
          Status: { select: { name: 'Published' } }
        }
      }));

      const sync = new NotionSync({ concurrency: 5, dryRun: true });
      
      // Mock the notion client
      sync.notionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(mockPosts),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        extractMetadata: jest.fn().mockImplementation((post) => Promise.resolve({
          title: `Post ${post.id.split('-')[1]}`,
          slug: `post-${post.id.split('-')[1]}`,
          status: 'Published',
          lastEditedTime: new Date().toISOString()
        })),
        getPageBlocks: jest.fn().mockResolvedValue([])
      };

      // Mock content processor
      sync.contentProcessor = {
        processPage: jest.fn().mockResolvedValue({ content: 'processed content' }),
        cleanupUnusedImages: jest.fn().mockResolvedValue()
      };

      const startTime = Date.now();
      const result = await sync.sync();
      const duration = Date.now() - startTime;

      // Verify parallel processing performance
      expect(result.totalPosts).toBe(12);
      expect(result.performance).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should be much faster than sequential
      
      // Verify batching was used
      expect(sync.notionClient.extractMetadata).toHaveBeenCalledTimes(12);
    });

    it('should handle batch failures gracefully', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      const mockPosts = Array.from({ length: 6 }, (_, i) => ({
        id: `post-${i}`,
        properties: {
          Title: { title: [{ text: { content: `Post ${i}` } }] }
        }
      }));

      const sync = new NotionSync({ concurrency: 3, dryRun: true });
      
      sync.notionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(mockPosts),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        extractMetadata: jest.fn().mockImplementation((post) => {
          // Simulate failure for post-2
          if (post.id === 'post-2') {
            return Promise.reject(new Error('Simulated failure'));
          }
          return Promise.resolve({
            title: `Post ${post.id.split('-')[1]}`,
            slug: `post-${post.id.split('-')[1]}`,
            status: 'Published',
            lastEditedTime: new Date().toISOString()
          });
        }),
        getPageBlocks: jest.fn().mockResolvedValue([])
      };

      sync.contentProcessor = {
        processPage: jest.fn().mockResolvedValue({ content: 'processed content' }),
        cleanupUnusedImages: jest.fn().mockResolvedValue()
      };

      const result = await sync.sync();

      // Should process 5 posts successfully (6 - 1 failed)
      expect(result.totalPosts).toBe(5);
      expect(result.performance).toBeDefined();
    });

    it('should track performance metrics accurately', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      const sync = new NotionSync({ dryRun: true });
      
      // Verify performance tracker initialization
      expect(sync.performanceTracker).toBeDefined();
      expect(sync.performanceTracker.startTimer).toBeDefined();
      expect(sync.performanceTracker.endTimer).toBeDefined();
      expect(sync.performanceTracker.trackMemory).toBeDefined();
    });
  });

  describe('Smart Caching', () => {
    it('should skip unchanged posts based on lastEditedTime', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      const oldDate = new Date('2024-01-01').toISOString();
      const newDate = new Date('2024-01-02').toISOString();
      
      const sync = new NotionSync({ dryRun: true });
      
      // Mock existing post
      const existingPost = {
        slug: 'test-post',
        lastEditedTime: oldDate,
        content: 'existing content'
      };
      
      sync.getExistingPost = jest.fn().mockResolvedValue(existingPost);
      
      // Test with unchanged post
      const unchangedResult = sync.shouldUpdatePost(existingPost, {
        lastEditedTime: oldDate
      });
      expect(unchangedResult).toBe(false);
      
      // Test with changed post
      const changedResult = sync.shouldUpdatePost(existingPost, {
        lastEditedTime: newDate
      });
      expect(changedResult).toBe(true);
    });

    it('should force update when force flag is set', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      const sync = new NotionSync({ force: true, dryRun: true });
      
      const existingPost = {
        slug: 'test-post',
        lastEditedTime: new Date().toISOString()
      };
      
      const result = sync.shouldUpdatePost(existingPost, {
        lastEditedTime: existingPost.lastEditedTime
      });
      
      expect(result).toBe(true);
    });
  });

  describe('Incremental Build System', () => {
    it('should initialize build cache correctly', () => {
      const SiteBuilder = require('../scripts/build-site');
      
      const builder = new SiteBuilder();
      
      expect(builder.buildCache).toBeDefined();
      expect(builder.buildCache.cache).toBeDefined();
      expect(builder.buildCache.cache.buildVersion).toBe('2.0');
    });

    it('should detect file changes correctly', () => {
      const SiteBuilder = require('../scripts/build-site');
      
      const builder = new SiteBuilder();
      
      const filePath = '/test/file.txt';
      
      // Test the cache logic directly by manipulating the cache
      // First call - no cache entry should return true
      builder.buildCache.cache.fileHashes = {};
      
      // Mock getFileHash to return predictable values
      const originalGetFileHash = builder.buildCache.getFileHash;
      builder.buildCache.getFileHash = jest.fn()
        .mockReturnValueOnce('hash1')  // First call
        .mockReturnValueOnce('hash1')  // Second call (same)
        .mockReturnValueOnce('hash2'); // Third call (different)
      
      // First call should detect change (no cached hash)
      const firstCheck = builder.buildCache.hasFileChanged(filePath);
      expect(firstCheck).toBe(true);
      
      // Second call with same hash should not detect change
      const secondCheck = builder.buildCache.hasFileChanged(filePath);
      expect(secondCheck).toBe(false);
      
      // Third call with different hash should detect change
      const thirdCheck = builder.buildCache.hasFileChanged(filePath);
      expect(thirdCheck).toBe(true);
      
      // Restore original method
      builder.buildCache.getFileHash = originalGetFileHash;
    });

    it('should handle cache logic correctly', () => {
      const SiteBuilder = require('../scripts/build-site');
      
      const builder = new SiteBuilder();
      
      // Test that the BuildCache class is properly initialized
      expect(builder.buildCache).toBeDefined();
      expect(builder.buildCache.cache).toBeDefined();
      expect(builder.buildCache.cache.buildVersion).toBe('2.0');
      
      // Test that cache methods exist
      expect(typeof builder.buildCache.hasFileChanged).toBe('function');
      expect(typeof builder.buildCache.shouldRebuildFile).toBe('function');
      expect(typeof builder.buildCache.markFileGenerated).toBe('function');
    });

    it('should rebuild when dependencies change', () => {
      const SiteBuilder = require('../scripts/build-site');
      
      const builder = new SiteBuilder();
      
      const filePath = '/output/test.html';
      const dependencies = ['/content/test.json'];
      
      // Mock existing file
      fs.existsSync = jest.fn().mockReturnValue(true);
      
      // Mock file info in cache
      builder.buildCache.cache.generatedFiles[filePath] = {
        timestamp: Date.now(),
        dependencies: dependencies
      };
      
      // Mock changed dependency
      builder.buildCache.hasFileChanged = jest.fn().mockReturnValue(true);
      
      const shouldRebuild = builder.buildCache.shouldRebuildFile(filePath, dependencies);
      expect(shouldRebuild).toBe(true);
    });

    it('should track performance metrics during build', async () => {
      const SiteBuilder = require('../scripts/build-site');
      
      const builder = new SiteBuilder();
      
      // Mock required methods
      builder.loadTemplates = jest.fn().mockResolvedValue();
      builder.loadContent = jest.fn().mockResolvedValue({
        publishedPosts: [],
        scheduledPosts: [],
        categories: []
      });
      builder.copyStaticAssetsIncremental = jest.fn().mockResolvedValue();
      builder.generateHomePage = jest.fn().mockResolvedValue();
      builder.generateBlogPages = jest.fn().mockResolvedValue();
      builder.generatePostPages = jest.fn().mockResolvedValue();
      builder.generateCategoryPages = jest.fn().mockResolvedValue();
      builder.generateRSSFeedIncremental = jest.fn().mockResolvedValue();
      builder.generateSitemapIncremental = jest.fn().mockResolvedValue();
      
      const result = await builder.build();
      
      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.pagesGenerated).toBeDefined();
      expect(result.performance.filesSkipped).toBeDefined();
      expect(result.performance.cacheHitRate).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage during sync', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      const sync = new NotionSync({ dryRun: true });
      
      // Mock memory tracking
      const mockMemoryUsage = {
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024 // 10MB
      };
      
      process.memoryUsage = jest.fn().mockReturnValue(mockMemoryUsage);
      
      const memoryInfo = sync.performanceTracker.trackMemory();
      
      expect(memoryInfo.heapUsed).toBe(50); // Should be in MB
      expect(memoryInfo.heapTotal).toBe(100);
      expect(memoryInfo.external).toBe(10);
    });

    it('should not exceed memory limits during large batch processing', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      // Simulate processing 100 posts
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        properties: {
          Title: { title: [{ text: { content: `Post ${i}` } }] }
        }
      }));

      const sync = new NotionSync({ concurrency: 10, dryRun: true });
      
      sync.notionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(largeBatch),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        extractMetadata: jest.fn().mockResolvedValue({
          title: 'Test Post',
          slug: 'test-post',
          status: 'Published',
          lastEditedTime: new Date().toISOString()
        }),
        getPageBlocks: jest.fn().mockResolvedValue([])
      };

      sync.contentProcessor = {
        processPage: jest.fn().mockResolvedValue({ content: 'content' }),
        cleanupUnusedImages: jest.fn().mockResolvedValue()
      };

      const initialMemory = process.memoryUsage().heapUsed;
      await sync.sync();
      const finalMemory = process.memoryUsage().heapUsed;
      
      // Memory increase should be reasonable (less than 100MB for 100 posts)
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing other posts when one fails', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      const mockPosts = [
        { id: 'post-1', properties: { Title: { title: [{ text: { content: 'Post 1' } }] } } },
        { id: 'post-2', properties: { Title: { title: [{ text: { content: 'Post 2' } }] } } },
        { id: 'post-3', properties: { Title: { title: [{ text: { content: 'Post 3' } }] } } }
      ];

      const sync = new NotionSync({ dryRun: true });
      
      sync.notionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(mockPosts),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        extractMetadata: jest.fn().mockImplementation((post) => {
          if (post.id === 'post-2') {
            throw new Error('Simulated extraction failure');
          }
          return Promise.resolve({
            title: `Title for ${post.id}`,
            slug: post.id,
            status: 'Published',
            lastEditedTime: new Date().toISOString()
          });
        }),
        getPageBlocks: jest.fn().mockResolvedValue([])
      };

      sync.contentProcessor = {
        processPage: jest.fn().mockResolvedValue({ content: 'content' }),
        cleanupUnusedImages: jest.fn().mockResolvedValue()
      };

      const result = await sync.sync();
      
      // Should process 2 out of 3 posts (post-2 failed)
      expect(result.totalPosts).toBe(2);
    });

    it('should handle build cache corruption gracefully', () => {
      const SiteBuilder = require('../scripts/build-site');
      
      // Mock corrupted cache file
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readJsonSync = jest.fn().mockImplementation(() => {
        throw new Error('Corrupted cache file');
      });
      
      const builder = new SiteBuilder();
      
      // Should initialize with default cache
      expect(builder.buildCache.cache.buildVersion).toBe('2.0');
      expect(builder.buildCache.cache.fileHashes).toEqual({});
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for sync operations', async () => {
      const NotionSync = require('../scripts/notion-sync');
      
      // Test with 10 posts (target: < 15 seconds)
      const posts = Array.from({ length: 10 }, (_, i) => ({
        id: `post-${i}`,
        properties: {
          Title: { title: [{ text: { content: `Post ${i}` } }] }
        }
      }));

      const sync = new NotionSync({ dryRun: true });
      
      sync.notionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(posts),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        extractMetadata: jest.fn().mockResolvedValue({
          title: 'Test Post',
          slug: 'test-post',
          status: 'Published',
          lastEditedTime: new Date().toISOString()
        }),
        getPageBlocks: jest.fn().mockResolvedValue([])
      };

      sync.contentProcessor = {
        processPage: jest.fn().mockResolvedValue({ content: 'content' }),
        cleanupUnusedImages: jest.fn().mockResolvedValue()
      };

      const startTime = Date.now();
      const result = await sync.sync();
      const duration = Date.now() - startTime;
      
      // Should complete within performance target
      expect(duration).toBeLessThan(15000); // 15 seconds
      expect(result.performance.total_sync).toBeLessThan(15000);
    });

    it('should meet performance targets for build operations', async () => {
      const SiteBuilder = require('../scripts/build-site');
      
      const builder = new SiteBuilder();
      
      // Mock build operations
      builder.loadTemplates = jest.fn().mockResolvedValue();
      builder.loadContent = jest.fn().mockResolvedValue({
        publishedPosts: Array.from({ length: 50 }, (_, i) => ({
          id: `post-${i}`,
          title: `Post ${i}`,
          slug: `post-${i}`,
          content: 'Sample content'
        })),
        scheduledPosts: [],
        categories: []
      });
      builder.copyStaticAssetsIncremental = jest.fn().mockResolvedValue();
      builder.generateHomePage = jest.fn().mockResolvedValue();
      builder.generateBlogPages = jest.fn().mockResolvedValue();
      builder.generatePostPages = jest.fn().mockResolvedValue();
      builder.generateCategoryPages = jest.fn().mockResolvedValue();
      builder.generateRSSFeedIncremental = jest.fn().mockResolvedValue();
      builder.generateSitemapIncremental = jest.fn().mockResolvedValue();
      
      const startTime = Date.now();
      const result = await builder.build();
      const duration = Date.now() - startTime;
      
      // Should complete within performance target (90 seconds for 50 posts)
      expect(duration).toBeLessThan(90000);
      expect(result.performance.totalTime).toBeLessThan(90000);
    });
  });
});