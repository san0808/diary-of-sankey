// Manual mock for NotionClient
module.exports = jest.fn().mockImplementation(() => ({
  testConnection: jest.fn().mockResolvedValue(true),
  getPublishedPosts: jest.fn().mockResolvedValue([]),
  getScheduledPosts: jest.fn().mockResolvedValue([]),
  getDraftPosts: jest.fn().mockResolvedValue([]),
  getPageBlocks: jest.fn().mockResolvedValue([]),
  extractMetadata: jest.fn().mockReturnValue({
    id: 'test-id',
    title: 'Test Post',
    slug: 'test-post',
    lastEditedTime: '2024-01-01T00:00:00Z'
  })
})); 