const NotionSync = require('../scripts/notion-sync');
const NotionClient = require('../scripts/utils/notion-client');
const ContentProcessor = require('../scripts/utils/content-processor');
const fs = require('fs-extra');
const path = require('path');

// Mock the dependencies
jest.mock('../scripts/utils/notion-client');
jest.mock('../scripts/utils/content-processor');
jest.mock('fs-extra');

describe('NotionSync', () => {
  let notionSync;
  let mockNotionClient;
  let mockContentProcessor;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock instances
    mockNotionClient = {
      testConnection: jest.fn(),
      getPublishedPosts: jest.fn(),
      getScheduledPosts: jest.fn(),
      getDraftPosts: jest.fn(),
      getPageBlocks: jest.fn(),
      extractMetadata: jest.fn()
    };
    
    mockContentProcessor = {
      processPage: jest.fn()
    };
    
    // Mock constructors
    NotionClient.mockImplementation(() => mockNotionClient);
    ContentProcessor.mockImplementation(() => mockContentProcessor);
    
    // Mock fs operations
    fs.ensureDirSync.mockImplementation(() => {});
    fs.writeJson.mockImplementation(() => Promise.resolve());
    fs.writeFile.mockImplementation(() => Promise.resolve());
    fs.pathExists.mockImplementation(() => Promise.resolve(false));
    fs.readJson.mockImplementation(() => Promise.resolve({}));
    
    notionSync = new NotionSync({ dryRun: true });
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const sync = new NotionSync();
      expect(sync.force).toBe(false);
      expect(sync.dryRun).toBe(false);
    });

    test('should initialize with custom options', () => {
      const sync = new NotionSync({ force: true, dryRun: true });
      expect(sync.force).toBe(true);
      expect(sync.dryRun).toBe(true);
    });

    test('should create content directory', () => {
      new NotionSync();
      expect(fs.ensureDirSync).toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    beforeEach(() => {
      mockNotionClient.testConnection.mockResolvedValue(true);
      mockNotionClient.getPublishedPosts.mockResolvedValue([]);
      mockNotionClient.getScheduledPosts.mockResolvedValue([]);
      mockNotionClient.getDraftPosts.mockResolvedValue([]);
    });

    test('should test connection first', async () => {
      await notionSync.sync();
      
      expect(mockNotionClient.testConnection).toHaveBeenCalled();
    });

    test('should throw error if connection fails', async () => {
      mockNotionClient.testConnection.mockResolvedValue(false);
      
      await expect(notionSync.sync()).rejects.toThrow('Failed to connect to Notion API');
    });

    test('should fetch all post types', async () => {
      await notionSync.sync();
      
      expect(mockNotionClient.getPublishedPosts).toHaveBeenCalled();
      expect(mockNotionClient.getScheduledPosts).toHaveBeenCalled();
      expect(mockNotionClient.getDraftPosts).toHaveBeenCalled();
    });

    test('should return sync statistics', async () => {
      mockNotionClient.getPublishedPosts.mockResolvedValue([
        { id: '1', title: 'Published Post' }
      ]);
      mockNotionClient.getScheduledPosts.mockResolvedValue([
        { id: '2', title: 'Scheduled Post' }
      ]);
      mockNotionClient.getDraftPosts.mockResolvedValue([
        { id: '3', title: 'Draft Post' }
      ]);
      
      const result = await notionSync.sync();
      
      expect(result).toEqual({
        totalPosts: 0, // No posts processed due to mocking
        published: 1,
        scheduled: 1,
        drafts: 1
      });
    });
  });

  describe('processPost', () => {
    const mockNotionPage = {
      id: 'page-123',
      properties: {
        Title: { title: [{ plain_text: 'Test Post' }] },
        Status: { select: { name: 'Published' } },
        Category: { select: { name: 'Blog' } }
      }
    };

    const mockMetadata = {
      id: 'page-123',
      title: 'Test Post',
      status: 'Published',
      category: 'Blog',
      slug: 'test-post',
      lastEditedTime: '2024-01-01T00:00:00Z'
    };

    const mockBlocks = [
      { id: 'block-1', type: 'paragraph' }
    ];

    const mockProcessedContent = {
      content: '<p>Test content</p>',
      readingTime: 1,
      wordCount: 2,
      excerpt: 'Test content'
    };

    beforeEach(() => {
      mockNotionClient.extractMetadata.mockReturnValue(mockMetadata);
      mockNotionClient.getPageBlocks.mockResolvedValue(mockBlocks);
      mockContentProcessor.processPage.mockResolvedValue(mockProcessedContent);
    });

    test('should extract metadata from Notion page', async () => {
      await notionSync.processPost(mockNotionPage);
      
      expect(mockNotionClient.extractMetadata).toHaveBeenCalledWith(mockNotionPage);
    });

    test('should get page blocks', async () => {
      await notionSync.processPost(mockNotionPage);
      
      expect(mockNotionClient.getPageBlocks).toHaveBeenCalledWith('page-123');
    });

    test('should process content', async () => {
      await notionSync.processPost(mockNotionPage);
      
      expect(mockContentProcessor.processPage).toHaveBeenCalledWith(mockNotionPage, mockBlocks);
    });

    test('should return combined post data', async () => {
      const result = await notionSync.processPost(mockNotionPage);
      
      expect(result).toMatchObject({
        ...mockMetadata,
        ...mockProcessedContent
      });
      expect(result.lastSynced).toBeDefined();
    });

    test('should skip unchanged posts when not forced', async () => {
      const existingPost = {
        lastEditedTime: '2024-01-02T00:00:00Z'
      };
      
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(existingPost);
      
      const result = await notionSync.processPost(mockNotionPage);
      
      expect(result).toBe(existingPost);
      expect(mockNotionClient.getPageBlocks).not.toHaveBeenCalled();
    });

    test('should process posts when forced', async () => {
      notionSync.force = true;
      
      const existingPost = {
        lastEditedTime: '2024-01-02T00:00:00Z'
      };
      
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(existingPost);
      
      await notionSync.processPost(mockNotionPage);
      
      expect(mockNotionClient.getPageBlocks).toHaveBeenCalled();
    });
  });

  describe('shouldUpdatePost', () => {
    test('should return true if no existing post', () => {
      const result = notionSync.shouldUpdatePost(null, { lastEditedTime: '2024-01-01' });
      expect(result).toBe(true);
    });

    test('should return true if forced', () => {
      notionSync.force = true;
      const result = notionSync.shouldUpdatePost(
        { lastEditedTime: '2024-01-02' },
        { lastEditedTime: '2024-01-01' }
      );
      expect(result).toBe(true);
    });

    test('should return true if new version is newer', () => {
      const result = notionSync.shouldUpdatePost(
        { lastEditedTime: '2024-01-01' },
        { lastEditedTime: '2024-01-02' }
      );
      expect(result).toBe(true);
    });

    test('should return false if existing version is newer', () => {
      const result = notionSync.shouldUpdatePost(
        { lastEditedTime: '2024-01-02' },
        { lastEditedTime: '2024-01-01' }
      );
      expect(result).toBe(false);
    });
  });

  describe('savePost', () => {
    const mockPostData = {
      slug: 'test-post',
      title: 'Test Post',
      content: '<p>Test content</p>'
    };

    test('should not save in dry run mode', async () => {
      notionSync.dryRun = true;
      
      await notionSync.savePost(mockPostData);
      
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    test('should save JSON and HTML files', async () => {
      notionSync.dryRun = false;
      fs.ensureDir.mockResolvedValue();
      
      await notionSync.savePost(mockPostData);
      
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('test-post.json'),
        mockPostData,
        { spaces: 2 }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-post.html'),
        '<p>Test content</p>'
      );
    });
  });

  describe('generateIndexes', () => {
    const mockPosts = [
      {
        id: '1',
        title: 'Post 1',
        status: 'Published',
        category: 'Blog',
        tags: ['tag1', 'tag2'],
        publishDate: '2024-01-01'
      },
      {
        id: '2',
        title: 'Post 2',
        status: 'Scheduled',
        category: 'Research',
        tags: ['tag2', 'tag3'],
        publishDate: '2024-01-02'
      }
    ];

    test('should not generate indexes in dry run mode', async () => {
      notionSync.dryRun = true;
      
      await notionSync.generateIndexes(mockPosts);
      
      expect(fs.writeJson).not.toHaveBeenCalled();
    });

    test('should generate posts index', async () => {
      notionSync.dryRun = false;
      
      await notionSync.generateIndexes(mockPosts);
      
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('posts-index.json'),
        expect.objectContaining({
          posts: expect.arrayContaining([
            expect.objectContaining({ title: 'Post 1' })
          ]),
          totalPosts: 1 // Only published posts
        }),
        { spaces: 2 }
      );
    });

    test('should generate category indexes', async () => {
      notionSync.dryRun = false;
      fs.ensureDir.mockResolvedValue();
      
      await notionSync.generateIndexes(mockPosts);
      
      expect(fs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('categories')
      );
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('categories/index.json'),
        expect.any(Object),
        { spaces: 2 }
      );
    });

    test('should generate tags index', async () => {
      notionSync.dryRun = false;
      
      await notionSync.generateIndexes(mockPosts);
      
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('tags-index.json'),
        expect.objectContaining({
          tags: expect.arrayContaining([
            expect.objectContaining({ name: 'tag1' }),
            expect.objectContaining({ name: 'tag2' })
          ])
        }),
        { spaces: 2 }
      );
    });

    test('should generate scheduled index when scheduled posts exist', async () => {
      notionSync.dryRun = false;
      
      await notionSync.generateIndexes(mockPosts);
      
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('scheduled-index.json'),
        expect.objectContaining({
          posts: expect.arrayContaining([
            expect.objectContaining({ title: 'Post 2' })
          ])
        }),
        { spaces: 2 }
      );
    });
  });

  describe('syncPost', () => {
    const mockPage = {
      id: 'page-123',
      properties: {}
    };

    test('should sync specific post by ID', async () => {
      mockNotionClient.getPage.mockResolvedValue(mockPage);
      mockNotionClient.extractMetadata.mockReturnValue({
        title: 'Test Post',
        slug: 'test-post'
      });
      mockNotionClient.getPageBlocks.mockResolvedValue([]);
      mockContentProcessor.processPage.mockResolvedValue({
        content: 'Test content'
      });
      
      const result = await notionSync.syncPost('page-123');
      
      expect(mockNotionClient.getPage).toHaveBeenCalledWith('page-123');
      expect(result).toMatchObject({
        title: 'Test Post',
        slug: 'test-post'
      });
    });

    test('should throw error if page not found', async () => {
      mockNotionClient.getPage.mockRejectedValue(new Error('Page not found'));
      
      await expect(notionSync.syncPost('invalid-id')).rejects.toThrow('Page not found');
    });
  });
}); 