// Manual mock for NotionClient
module.exports = jest.fn().mockImplementation((options = {}) => {
  // Constructor validation logic matching the real class
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.NOTION_API_KEY;
  const databaseId = options.databaseId !== undefined ? options.databaseId : process.env.NOTION_DATABASE_ID;
  
  if (!apiKey) {
    throw new Error('Notion API key is required');
  }
  
  if (!databaseId) {
    throw new Error('Notion database ID is required');
  }
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
    extractMetadata: jest.fn().mockImplementation((page) => {
      // Return a response that matches the test expectation structure
      return {
        id: page.id,
        title: mockInstance.getPropertyValue(page.properties?.Title) || 'Default Title',
        slug: mockInstance.generateSlug(mockInstance.getPropertyValue(page.properties?.Title) || 'default'),
        status: mockInstance.getPropertyValue(page.properties?.Status) || 'Draft',
        category: mockInstance.getPropertyValue(page.properties?.Category) || null,
        publishDate: mockInstance.getPropertyValue(page.properties?.['Publish Date']) || null,
        tags: mockInstance.getPropertyValue(page.properties?.Tags) || [],
        author: mockInstance.getPropertyValue(page.properties?.Author) || null,
        featured: mockInstance.getPropertyValue(page.properties?.Featured) || false,
        createdTime: page.created_time || null,
        lastEditedTime: page.last_edited_time || null,
        excerpt: null,
        featuredImage: null
      };
    }),
    getPropertyValue: jest.fn().mockImplementation((property) => {
      if (!property) return null;
      
      switch (property.type) {
        case 'title':
          return property.title?.[0]?.plain_text || null;
        case 'select':
          return property.select?.name || null;
        case 'multi_select':
          return property.multi_select?.map(option => option.name) || [];
        case 'rich_text':
          return property.rich_text?.map(text => text.plain_text).join('') || null;
        case 'date':
          return property.date?.start || null;
        case 'checkbox':
          return property.checkbox || false;
        default:
          return null;
      }
    }),
    generateSlug: jest.fn().mockImplementation((title) => 
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    ),

    // Rate limiting and retry logic (internal methods)
    checkRateLimit: jest.fn().mockResolvedValue(),
    withRetry: jest.fn().mockImplementation(async (operation) => operation()),

    // Mock configuration
    apiKey: apiKey,
    databaseId: databaseId,
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