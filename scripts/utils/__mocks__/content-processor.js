// Manual mock for ContentProcessor
module.exports = jest.fn().mockImplementation(() => {
  const mockInstance = {
    // Main processing methods
  processPage: jest.fn().mockResolvedValue({
      content: '<p class="mt-4 font-serif text-lg">Test content</p>',
    readingTime: 1,
    wordCount: 2,
    excerpt: 'Test content',
    tableOfContents: []
  }),
    processBlocks: jest.fn().mockResolvedValue('<p>Test content</p>'),
    processBlock: jest.fn().mockResolvedValue('<p>Test block</p>'),

    // Block type processors
    processParagraph: jest.fn().mockReturnValue('<p class="mt-4 font-serif text-lg">Test paragraph</p>'),
    processHeading1: jest.fn().mockReturnValue('<h1 class="text-4xl font-bold mt-8 mb-4">Test Heading</h1>'),
    processHeading2: jest.fn().mockReturnValue('<h2 class="text-3xl font-bold mt-6 mb-3">Test Heading</h2>'),
    processHeading3: jest.fn().mockReturnValue('<h3 class="text-2xl font-bold mt-4 mb-2">Test Heading</h3>'),
    processBulletedListItem: jest.fn().mockResolvedValue('<li>Test list item</li>'),
    processNumberedListItem: jest.fn().mockResolvedValue('<li>Test numbered item</li>'),
    processCodeBlock: jest.fn().mockReturnValue('<pre><code>test code</code></pre>'),
    processQuote: jest.fn().mockReturnValue('<blockquote>Test quote</blockquote>'),
    processCallout: jest.fn().mockReturnValue('<div class="callout">Test callout</div>'),
    processImage: jest.fn().mockResolvedValue('<img src="/static/images/test.jpg" alt="Test image">'),
    processEquation: jest.fn().mockReturnValue('<div class="equation">Test equation</div>'),
    processTable: jest.fn().mockReturnValue('<table>Test table</table>'),
    processDivider: jest.fn().mockReturnValue('<hr>'),
    processBookmark: jest.fn().mockReturnValue('<a href="https://example.com">Test bookmark</a>'),
    processEmbed: jest.fn().mockReturnValue('<div class="embed">Test embed</div>'),

    // Content processing utilities
    extractRichText: jest.fn().mockReturnValue('Test rich text'),
    generateHeadingId: jest.fn().mockImplementation((text) => 
      text.toLowerCase().replace(/[^\w]+/g, '-')
    ),
    getHeadingClasses: jest.fn().mockReturnValue('text-4xl font-bold mt-8 mb-4'),
    renderCodeBlock: jest.fn().mockReturnValue('<pre><code>test code</code></pre>'),

    // List processing utilities
    openList: jest.fn().mockReturnValue('<ul class="list-disc ml-4 font-serif">'),
    closeList: jest.fn().mockReturnValue('</ul>'),

    // Image processing
    processImageUrl: jest.fn().mockResolvedValue('/static/images/test.jpg'),
    downloadImage: jest.fn().mockResolvedValue('/static/images/downloaded.jpg'),
    getImageExtension: jest.fn().mockReturnValue('.jpg'),
    cleanupUnusedImages: jest.fn().mockResolvedValue(['image1.jpg', 'image2.png']),

    // Content analysis
    calculateReadingTime: jest.fn().mockReturnValue(5),
    countWords: jest.fn().mockReturnValue(100),
    generateTableOfContents: jest.fn().mockReturnValue([
      { id: 'heading-1', text: 'Test Heading', level: 1 }
    ]),
    extractExcerpt: jest.fn().mockReturnValue('Test excerpt from content...'),

    // Utility methods
    escapeHtml: jest.fn().mockImplementation((text) => 
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    ),

    // Configuration
    preserveDesign: true,
    enableSyntaxHighlighting: true,
    enableMathJax: true,
    blockProcessors: {}
  };

  // Allow tests to override mock behavior
  mockInstance._setMockError = (method, error) => {
    mockInstance[method].mockRejectedValue(error);
  };

  mockInstance._setMockResult = (method, result) => {
    if (typeof mockInstance[method].mockResolvedValue === 'function') {
      mockInstance[method].mockResolvedValue(result);
    } else {
      mockInstance[method].mockReturnValue(result);
    }
  };

  return mockInstance;
}); 