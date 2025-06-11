// Manual mock for NotionClient
module.exports = jest.fn().mockImplementation(() => {
  const mockInstance = {
    // API connection and authentication
    testConnection: jest.fn().mockResolvedValue(true),
    getDatabaseSchema: jest.fn().mockResolvedValue({
      properties: {
        Title: { type: 'title' },
        Status: { type: 'select' },
        Category: { type: 'select' },
        'Publish Date': { type: 'date' },
        Tags: { type: 'multi_select' }
      }
    }),

    // Database query methods
    queryDatabase: jest.fn().mockResolvedValue([]),
    getPublishedPosts: jest.fn().mockResolvedValue([]),
    getScheduledPosts: jest.fn().mockResolvedValue([]),
    getDraftPosts: jest.fn().mockResolvedValue([]),
    getPostsByCategory: jest.fn().mockResolvedValue([]),

    // Page and content methods
    getPage: jest.fn().mockResolvedValue({
      id: 'test-page-id',
      properties: {
        Title: { title: [{ plain_text: 'Test Post' }] },
        Status: { select: { name: 'Published' } }
      }
    }),
    getPageBlocks: jest.fn().mockResolvedValue([]),
    pageToMarkdown: jest.fn().mockResolvedValue('# Test Content'),

    // Page operations
    updatePublishDate: jest.fn().mockResolvedValue({}),

    // Utility methods
    extractMetadata: jest.fn().mockReturnValue({
      id: 'test-id',
      title: 'Test Post',
      slug: 'test-post',
      lastEditedTime: '2024-01-01T00:00:00Z',
      publishDate: '2024-01-01',
      status: 'Published',
      category: 'Blog',
      tags: ['test', 'jest'],
      author: 'Test Author',
      featured: false
    }),
    getPropertyValue: jest.fn().mockReturnValue('default-value'),
    generateSlug: jest.fn().mockImplementation((title) => 
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    ),

    // Rate limiting and retry logic (internal methods)
    checkRateLimit: jest.fn().mockResolvedValue(),
    withRetry: jest.fn().mockImplementation(async (operation) => operation()),

    // Mock configuration
    apiKey: 'test-api-key',
    databaseId: 'test-database-id',
    rateLimiter: {
      requests: 0,
      resetTime: Date.now() + 60000,
      maxRequests: 3
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    }
  };

  // Allow tests to override mock behavior
  mockInstance._setMockError = (method, error) => {
    mockInstance[method].mockRejectedValue(error);
  };

  mockInstance._setMockResult = (method, result) => {
    mockInstance[method].mockResolvedValue(result);
  };

  return mockInstance;
}); 