const fs = require('fs-extra');
const path = require('path');

// Mock dependencies  
jest.mock('fs-extra');

describe('Performance & Reliability Integration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    // Mock file system
    fs.ensureDirSync = jest.fn();
    fs.pathExists = jest.fn().mockResolvedValue(true);
    fs.readFile = jest.fn();
    fs.writeFile = jest.fn();
    fs.readdir = jest.fn().mockResolvedValue([]);
    fs.stat = jest.fn().mockResolvedValue({ 
      isFile: () => true, 
      mtime: new Date(),
      size: 1024 * 1024 // 1MB default
    });
    fs.copy = jest.fn();
    fs.remove = jest.fn();
    
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Memory Management & Large Content', () => {
    it('should handle very large blog posts without memory exhaustion', async () => {
      const ContentProcessor = require('../../scripts/utils/content-processor');
      
      // Simulate a very large blog post (10MB of content)
      const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB string
      
      const largeBlocks = Array.from({ length: 1000 }, (_, i) => ({
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: largeContent.slice(i * 1000, (i + 1) * 1000) } }]
        }
      }));

      const processor = new ContentProcessor();
      
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      const result = await processor.processBlocks(largeBlocks);
      
      const endMemory = process.memoryUsage().heapUsed;
      const duration = Date.now() - startTime;
      
      // Should not consume excessive memory (< 50MB increase)
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // Should complete in reasonable time (< 10 seconds)
      expect(duration).toBeLessThan(10000);
      
      expect(typeof result).toBe('string');
    });

    it('should handle thousands of images without running out of memory', async () => {
      const ContentProcessor = require('../../scripts/utils/content-processor');
      
      // Simulate processing 500 images
      const imageBlocks = Array.from({ length: 500 }, (_, i) => ({
        type: 'image',
        image: {
          type: 'external',
          external: { url: `https://example.com/image-${i}.jpg` }
        }
      }));

      const processor = new ContentProcessor();
      
      // Mock image processing to avoid actual downloads
      processor.processImageUrl = jest.fn().mockResolvedValue('/static/images/cached.jpg');
      
      const startTime = Date.now();
      
      const results = await Promise.all(
        imageBlocks.map(block => processor.processImage(block))
      );
      
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(500);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(processor.processImageUrl).toHaveBeenCalledTimes(500);
    });
  });

  describe('File System Performance', () => {
    it('should handle concurrent file operations without corruption', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      // Mock multiple posts being processed simultaneously
      const posts = Array.from({ length: 50 }, (_, i) => ({
        id: `post-${i}`,
        title: `Post ${i}`,
        content: `Content for post ${i}`,
        slug: `post-${i}`
      }));

      // Track file write operations
      const writeOperations = [];
      fs.writeFile.mockImplementation((filePath, content) => {
        writeOperations.push({ filePath, contentLength: content.length, timestamp: Date.now() });
        return Promise.resolve();
      });

      const sync = new NotionSync({ dryRun: false });
      
      // Process posts concurrently
      await Promise.all(
        posts.map(post => sync.savePost(post))
      );

      // Verify all writes completed
      expect(writeOperations).toHaveLength(50);
      
      // Check for race conditions (no duplicate file paths)
      const filePaths = writeOperations.map(op => op.filePath);
      const uniquePaths = [...new Set(filePaths)];
      expect(uniquePaths).toHaveLength(filePaths.length);
    });

    it('should handle file system being temporarily unavailable', async () => {
      const SiteBuilder = require('../../scripts/build-site');
      
      // Simulate intermittent file system failures
      let failureCount = 0;
      fs.writeFile.mockImplementation(() => {
        failureCount++;
        if (failureCount <= 3) {
          const error = new Error('EBUSY: resource busy or locked');
          error.code = 'EBUSY';
          return Promise.reject(error);
        }
        return Promise.resolve();
      });

      const builder = new SiteBuilder();
      
      // Should eventually succeed despite temporary failures
      await expect(builder.build()).not.toThrow();
      expect(failureCount).toBeGreaterThan(3);
    });
  });

  describe('API Rate Limiting & Network Resilience', () => {
    it('should respect Notion API rate limits under load', async () => {
      const NotionClient = require('../../scripts/utils/notion-client');
      
      const client = new NotionClient();
      
      // Track API call timestamps
      const apiCalls = [];
      
      const mockApiCall = jest.fn().mockImplementation(() => {
        apiCalls.push(Date.now());
        return Promise.resolve('success');
      });

      // Simulate burst of API calls
      const operations = Array.from({ length: 20 }, (_, i) => 
        client.withRetry(mockApiCall, `operation-${i}`)
      );

      await Promise.all(operations);

      // Verify rate limiting (no more than 3 calls per second)
      for (let i = 1; i < apiCalls.length; i++) {
        const timeDiff = apiCalls[i] - apiCalls[i - 1];
        if (i % 3 === 0) {
          // Every 3rd call should have at least 1 second gap
          expect(timeDiff).toBeGreaterThan(900); // 900ms tolerance
        }
      }
    });

    it('should handle prolonged network connectivity issues', async () => {
      const NotionClient = require('../../scripts/utils/notion-client');
      
      const client = new NotionClient();
      
      // Simulate network being down for extended period
      let attempt = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt < 10) {
          const error = new Error('ECONNREFUSED');
          error.code = 'ECONNREFUSED';
          throw error;
        }
        return Promise.resolve('success');
      });

      // Should eventually succeed or fail gracefully
      const result = await client.withRetry(mockOperation, 'network test');
      
      expect(result).toBe('success');
      expect(attempt).toBe(10);
    });
  });

  describe('Error Cascade Prevention', () => {
    it('should prevent single post failure from breaking entire sync', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      const posts = [
        { id: '1', title: 'Good Post 1' },
        { id: '2', title: null }, // Bad post - null title
        { id: '3', title: 'Good Post 2' },
        { id: '4', content: undefined }, // Bad post - undefined content  
        { id: '5', title: 'Good Post 3' }
      ];

      const mockNotionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue(posts),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([]),
        getPage: jest.fn().mockImplementation((id) => {
          if (id === '2' || id === '4') {
            throw new Error('Corrupted post data');
          }
          return Promise.resolve({ id });
        }),
        getBlocks: jest.fn().mockResolvedValue([])
      };

      const sync = new NotionSync({ dryRun: true });
      sync.notionClient = mockNotionClient;
      
      const result = await sync.sync();
      
      // Should process 3 good posts despite 2 failures
      expect(result.totalPosts).toBe(3);
    });

    it('should handle build process gracefully when templates are missing', async () => {
      const SiteBuilder = require('../../scripts/build-site');
      
      // Mock missing template files
      fs.pathExists.mockImplementation((filePath) => {
        if (filePath.includes('template')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('template')) {
          const error = new Error('Template not found');
          error.code = 'ENOENT';
          throw error;
        }
        return Promise.resolve('fallback content');
      });

      const builder = new SiteBuilder();
      
      // Should not crash, should use fallback templates
      await expect(builder.build()).not.toThrow();
    });
  });

  describe('Resource Cleanup & Memory Leaks', () => {
    it('should properly clean up resources after sync completion', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      const sync = new NotionSync();
      
      // Mock resource-intensive operations
      const mockCleanup = jest.fn();
      sync.contentProcessor.cleanupUnusedImages = mockCleanup;
      
      const mockNotionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue([]),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([])
      };
      
      sync.notionClient = mockNotionClient;
      
      await sync.sync();
      
      // Verify cleanup was called
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should detect and prevent memory leaks in long-running processes', async () => {
      const ContentProcessor = require('../../scripts/utils/content-processor');
      
      const processor = new ContentProcessor();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate processing many posts in a long-running process
      for (let i = 0; i < 100; i++) {
        const blocks = Array.from({ length: 10 }, () => ({
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: `Content ${i}` } }] }
        }));
        
        await processor.processBlocks(blocks);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (< 20MB)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe('Build Performance Under Load', () => {
    it('should maintain reasonable build times with large sites', async () => {
      const SiteBuilder = require('../../scripts/build-site');
      
      // Mock large site content
      const largeSiteContent = {
        publishedPosts: Array.from({ length: 500 }, (_, i) => ({
          id: `post-${i}`,
          title: `Post ${i}`,
          slug: `post-${i}`,
          content: 'Sample content'.repeat(100),
          publishDate: '2024-01-01',
          category: 'Blog'
        })),
        scheduledPosts: [],
        categories: Array.from({ length: 20 }, (_, i) => ({
          name: `Category ${i}`,
          slug: `category-${i}`
        }))
      };

      // Mock content loading
      fs.readJson = jest.fn().mockResolvedValue(largeSiteContent);

      const builder = new SiteBuilder();
      
      const startTime = Date.now();
      await builder.build();
      const buildTime = Date.now() - startTime;
      
      // Build should complete within reasonable time (< 30 seconds for 500 posts)
      expect(buildTime).toBeLessThan(30000);
    });
  });

  describe('Concurrent Process Safety', () => {
    it('should handle multiple sync processes attempting to run simultaneously', async () => {
      const NotionSync = require('../../scripts/notion-sync');
      
      // Create multiple sync instances
      const sync1 = new NotionSync({ dryRun: true });
      const sync2 = new NotionSync({ dryRun: true });
      
      const mockNotionClient = {
        testConnection: jest.fn().mockResolvedValue(true),
        getPublishedPosts: jest.fn().mockResolvedValue([]),
        getScheduledPosts: jest.fn().mockResolvedValue([]),
        getDraftPosts: jest.fn().mockResolvedValue([])
      };
      
      sync1.notionClient = mockNotionClient;
      sync2.notionClient = mockNotionClient;
      
      // Run simultaneously
      const [result1, result2] = await Promise.all([
        sync1.sync(),
        sync2.sync()
      ]);
      
      // Both should complete successfully
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
}); 