const fs = require('fs-extra');

// Use manual mocks
jest.mock('../scripts/utils/notion-client');
jest.mock('../scripts/utils/content-processor');
jest.mock('fs-extra');

const NotionSync = require('../scripts/notion-sync');
const NotionClient = require('../scripts/utils/notion-client');
const ContentProcessor = require('../scripts/utils/content-processor');

describe('NotionSync', () => {
  let notionSync;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    fs.ensureDirSync = jest.fn();
    fs.ensureDir = jest.fn().mockResolvedValue();
    fs.writeJson = jest.fn().mockResolvedValue();
    fs.writeFile = jest.fn().mockResolvedValue();
    fs.pathExists = jest.fn().mockResolvedValue(false);
    fs.readJson = jest.fn().mockResolvedValue({});
    
    // Create instance with dry run to avoid file operations
    notionSync = new NotionSync({ dryRun: true });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const sync = new NotionSync();
      expect(sync.force).toBe(false);
      expect(sync.dryRun).toBe(false);
      expect(NotionClient).toHaveBeenCalled();
      expect(ContentProcessor).toHaveBeenCalled();
    });

    it('should initialize with custom options', () => {
      const sync = new NotionSync({ force: true, dryRun: true });
      expect(sync.force).toBe(true);
      expect(sync.dryRun).toBe(true);
    });
  });

  describe('shouldUpdatePost', () => {
    it('should return true if no existing post', () => {
      const result = notionSync.shouldUpdatePost(null, { lastEditedTime: '2024-01-01' });
      expect(result).toBe(true);
    });

    it('should return true if forced', () => {
      notionSync.force = true;
      const existingPost = { lastEditedTime: '2024-01-02' };
      const newMetadata = { lastEditedTime: '2024-01-01' };
      
      const result = notionSync.shouldUpdatePost(existingPost, newMetadata);
      expect(result).toBe(true);
    });

    it('should return true if new version is newer', () => {
      const existingPost = { lastEditedTime: '2024-01-01' };
      const newMetadata = { lastEditedTime: '2024-01-02' };
      
      const result = notionSync.shouldUpdatePost(existingPost, newMetadata);
      expect(result).toBe(true);
    });

    it('should return false if existing version is newer', () => {
      const existingPost = { lastEditedTime: '2024-01-02' };
      const newMetadata = { lastEditedTime: '2024-01-01' };
      
      const result = notionSync.shouldUpdatePost(existingPost, newMetadata);
      expect(result).toBe(false);
    });
  });

  describe('sync', () => {
    it('should test connection first', async () => {
      const result = await notionSync.sync();
      const mockInstance = NotionClient.mock.results[0].value;
      expect(mockInstance.testConnection).toHaveBeenCalled();
    });

    it('should throw error if connection fails', async () => {
      const mockInstance = NotionClient.mock.results[0].value;
      mockInstance.testConnection.mockResolvedValue(false);
      
      await expect(notionSync.sync()).rejects.toThrow('Failed to connect to Notion API');
    });

    it('should fetch all post types', async () => {
      await notionSync.sync();
      const mockInstance = NotionClient.mock.results[0].value;
      
      expect(mockInstance.getPublishedPosts).toHaveBeenCalled();
      expect(mockInstance.getScheduledPosts).toHaveBeenCalled();
      expect(mockInstance.getDraftPosts).toHaveBeenCalled();
    });

    it('should return sync statistics', async () => {
      const mockInstance = NotionClient.mock.results[0].value;
      mockInstance.getPublishedPosts.mockResolvedValue([{ id: '1' }]);
      mockInstance.getScheduledPosts.mockResolvedValue([{ id: '2' }]);
      mockInstance.getDraftPosts.mockResolvedValue([{ id: '3' }]);
      
      const result = await notionSync.sync();
      
      expect(result).toEqual({
        totalPosts: 3, // All 3 mocked posts were processed
        published: 1,
        scheduled: 1,
        drafts: 1,
        performance: expect.any(Object)
      });
    });
  });

  describe('savePost in dry run mode', () => {
    it('should not actually save files in dry run mode', async () => {
      const postData = { slug: 'test-post', content: '<p>Test</p>' };
      
      await notionSync.savePost(postData);
      
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
}); 