// Manual mock for ContentProcessor
module.exports = jest.fn().mockImplementation(() => ({
  processPage: jest.fn().mockResolvedValue({
    content: '<p>Test content</p>',
    readingTime: 1,
    wordCount: 2,
    excerpt: 'Test content',
    tableOfContents: []
  }),
  cleanupUnusedImages: jest.fn().mockResolvedValue()
})); 