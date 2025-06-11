// Mock dependencies before importing
jest.mock('fs-extra');
jest.mock('https');
jest.mock('http');
jest.mock('../scripts/utils/logger');

const ContentProcessor = require('../scripts/utils/content-processor');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');

const logger = require('../scripts/utils/logger');

describe('ContentProcessor', () => {
  let contentProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger methods
    logger.timer = jest.fn(() => jest.fn());
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock fs-extra
    fs.ensureDirSync = jest.fn();
    fs.pathExists = jest.fn().mockResolvedValue(false);
    fs.createWriteStream = jest.fn();
    fs.readdir = jest.fn().mockResolvedValue([]);
    fs.stat = jest.fn().mockResolvedValue({ isFile: () => true });
    fs.unlink = jest.fn().mockResolvedValue();

    contentProcessor = new ContentProcessor();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const processor = new ContentProcessor();
      expect(processor.preserveDesign).toBe(true);
      expect(processor.enableSyntaxHighlighting).toBe(true);
      expect(processor.enableMathJax).toBe(true);
    });

    it('should initialize with custom options', () => {
      const processor = new ContentProcessor({
        preserveDesign: false,
        enableSyntaxHighlighting: false,
        enableMathJax: false
      });
      expect(processor.preserveDesign).toBe(false);
      expect(processor.enableSyntaxHighlighting).toBe(false);
      expect(processor.enableMathJax).toBe(false);
    });

    it('should have block processors configured', () => {
      expect(typeof contentProcessor.blockProcessors.paragraph).toBe('function');
      expect(typeof contentProcessor.blockProcessors.heading_1).toBe('function');
      expect(typeof contentProcessor.blockProcessors.image).toBe('function');
    });
  });

  describe('processPage', () => {
    it('should process a complete page with all metadata', async () => {
      const mockPage = {
        properties: {
          Title: { title: [{ plain_text: 'Test Post' }] }
        }
      };

      const mockBlocks = [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'This is a test paragraph.' }]
          }
        }
      ];

      const result = await contentProcessor.processPage(mockPage, mockBlocks);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('readingTime');
      expect(result).toHaveProperty('tableOfContents');
      expect(result).toHaveProperty('excerpt');
      expect(result).toHaveProperty('wordCount');
      expect(typeof result.readingTime).toBe('number');
      expect(Array.isArray(result.tableOfContents)).toBe(true);
    });

    it('should handle processing errors gracefully', async () => {
      const mockPage = { properties: {} };
      const mockBlocks = [
        {
          type: 'invalid_block',
          invalid_block: {}
        }
      ];

      await expect(contentProcessor.processPage(mockPage, mockBlocks))
        .resolves.toHaveProperty('content');
    });
  });

  describe('processBlocks', () => {
    it('should process array of blocks', async () => {
      const blocks = [
        {
          id: 'block1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'First paragraph' }]
          }
        },
        {
          id: 'block2',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Test Heading' }]
          }
        }
      ];

      const result = await contentProcessor.processBlocks(blocks);

      expect(result).toContain('First paragraph');
      expect(result).toContain('Test Heading');
    });

    it('should group list items correctly', async () => {
      const blocks = [
        {
          id: 'block1',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'Item 1' }]
          }
        },
        {
          id: 'block2',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'Item 2' }]
          }
        }
      ];

      const result = await contentProcessor.processBlocks(blocks);

      expect(result).toContain('<ul');
      expect(result).toContain('</ul>');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    it('should handle mixed list types', async () => {
      const blocks = [
        {
          id: 'block1',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'Bullet item' }]
          }
        },
        {
          id: 'block2',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ plain_text: 'Numbered item' }]
          }
        }
      ];

      const result = await contentProcessor.processBlocks(blocks);

      expect(result).toContain('<ul');
      expect(result).toContain('<ol');
      expect(result).toContain('</ul>');
      expect(result).toContain('</ol>');
    });
  });

  describe('block processors', () => {
    describe('processParagraph', () => {
      it('should process paragraph with rich text', () => {
        const block = {
          paragraph: {
            rich_text: [
              { plain_text: 'This is a ', annotations: { bold: false } },
              { plain_text: 'test', annotations: { bold: true } },
              { plain_text: ' paragraph.', annotations: { bold: false } }
            ]
          }
        };

        const result = contentProcessor.processParagraph(block);

        expect(result).toContain('This is a');
        expect(result).toContain('test');
        expect(result).toContain('paragraph');
      });

      it('should return empty string for empty paragraph', () => {
        const block = {
          paragraph: {
            rich_text: []
          }
        };

        const result = contentProcessor.processParagraph(block);
        expect(result).toBe('');
      });
    });

    describe('processHeading1', () => {
      it('should process heading with proper classes', () => {
        const block = {
          heading_1: {
            rich_text: [{ plain_text: 'Main Heading' }]
          }
        };

        const result = contentProcessor.processHeading1(block);

        expect(result).toContain('<h1');
        expect(result).toContain('Main Heading');
        expect(result).toContain('text-4xl');
      });
    });

    describe('processCodeBlock', () => {
      it('should process code block with language', () => {
        const block = {
          code: {
            rich_text: [{ plain_text: 'console.log("hello");' }],
            language: 'javascript'
          }
        };

        const result = contentProcessor.processCodeBlock(block);

        expect(result).toContain('<pre');
        expect(result).toContain('console.log');
        expect(result).toContain('javascript');
      });

      it('should process code block without language', () => {
        const block = {
          code: {
            rich_text: [{ plain_text: 'some code' }],
            language: null
          }
        };

        const result = contentProcessor.processCodeBlock(block);

        expect(result).toContain('<pre');
        expect(result).toContain('some code');
      });
    });

    describe('processCallout', () => {
      it('should process callout with icon and text', () => {
        const block = {
          callout: {
            icon: { emoji: '💡' },
            rich_text: [{ plain_text: 'Important note' }]
          }
        };

        const result = contentProcessor.processCallout(block);

        expect(result).toContain('callout');
        expect(result).toContain('💡');
        expect(result).toContain('Important note');
      });
    });

    describe('processImage', () => {
      it('should process image with local processing', async () => {
        const block = {
          image: {
            file: {
              url: 'https://example.com/image.jpg'
            },
            caption: [{ plain_text: 'Test image' }]
          }
        };

        // Mock image processing
        contentProcessor.processImageUrl = jest.fn().mockResolvedValue('/static/images/processed.jpg');

        const result = await contentProcessor.processImage(block);

        expect(result).toContain('<img');
        expect(result).toContain('/static/images/processed.jpg');
        expect(result).toContain('Test image');
      });

      it('should handle image processing errors', async () => {
        const block = {
          image: {
            file: {
              url: 'https://example.com/invalid.jpg'
            }
          }
        };

        contentProcessor.processImageUrl = jest.fn().mockRejectedValue(new Error('Download failed'));

        const result = await contentProcessor.processImage(block);

        expect(result).toContain('https://example.com/invalid.jpg');
      });
    });

    describe('processQuote', () => {
      it('should process quote block', () => {
        const block = {
          quote: {
            rich_text: [{ plain_text: 'This is a quote' }]
          }
        };

        const result = contentProcessor.processQuote(block);

        expect(result).toContain('<blockquote');
        expect(result).toContain('This is a quote');
      });
    });
  });

  describe('extractRichText', () => {
    it('should extract plain text from rich text array', () => {
      const richText = [
        { plain_text: 'Hello ' },
        { plain_text: 'world', annotations: { bold: true } },
        { plain_text: '!' }
      ];

      const result = contentProcessor.extractRichText(richText);

      expect(result).toContain('Hello');
      expect(result).toContain('world');
      expect(result).toContain('<strong>world</strong>');
    });

    it('should handle empty rich text', () => {
      const result = contentProcessor.extractRichText([]);
      expect(result).toBe('');
    });

    it('should handle rich text with various annotations', () => {
      const richText = [
        { plain_text: 'bold', annotations: { bold: true } },
        { plain_text: 'italic', annotations: { italic: true } },
        { plain_text: 'code', annotations: { code: true } },
        { plain_text: 'strikethrough', annotations: { strikethrough: true } }
      ];

      const result = contentProcessor.extractRichText(richText);

      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<code>code</code>');
      expect(result).toContain('<del>strikethrough</del>');
    });
  });

  describe('image processing', () => {
    describe('processImageUrl', () => {
      it('should process image URL and return local path', async () => {
        fs.pathExists.mockResolvedValue(false);
        
        const mockWriteStream = {
          on: jest.fn(),
          close: jest.fn()
        };
        fs.createWriteStream.mockReturnValue(mockWriteStream);

        // Mock successful download
        contentProcessor.downloadImage = jest.fn().mockResolvedValue('/static/images/downloaded.jpg');

        const result = await contentProcessor.processImageUrl('https://example.com/image.jpg');

        expect(result).toBe('/static/images/downloaded.jpg');
      });

      it('should return existing image path if already cached', async () => {
        fs.pathExists.mockResolvedValue(true);

        const result = await contentProcessor.processImageUrl('https://example.com/image.jpg');

        expect(result).toContain('/static/images/');
        expect(result).toContain('image.jpg');
      });
    });

    describe('getImageExtension', () => {
      it('should extract extension from URL', () => {
        expect(contentProcessor.getImageExtension('https://example.com/image.jpg')).toBe('jpg');
        expect(contentProcessor.getImageExtension('https://example.com/photo.png')).toBe('png');
        expect(contentProcessor.getImageExtension('https://example.com/file.webp')).toBe('webp');
      });

      it('should return jpg as default extension', () => {
        expect(contentProcessor.getImageExtension('https://example.com/noextension')).toBe('jpg');
        expect(contentProcessor.getImageExtension('https://example.com/file')).toBe('jpg');
      });
    });

    describe('cleanupUnusedImages', () => {
      it('should identify and remove unused images', async () => {
        fs.readdir.mockResolvedValue(['image1.jpg', 'image2.png', 'image3.gif']);
        fs.stat.mockResolvedValue({ isFile: () => true });

        const result = await contentProcessor.cleanupUnusedImages();

        expect(Array.isArray(result)).toBe(true);
        expect(fs.readdir).toHaveBeenCalled();
      });
    });
  });

  describe('content analysis', () => {
    describe('calculateReadingTime', () => {
      it('should calculate reading time based on word count', () => {
        const html = '<p>This is a test paragraph with several words to count for reading time.</p>';
        const readingTime = contentProcessor.calculateReadingTime(html);

        expect(typeof readingTime).toBe('number');
        expect(readingTime).toBeGreaterThan(0);
      });

      it('should return minimum 1 minute for any content', () => {
        const html = '<p>Short</p>';
        const readingTime = contentProcessor.calculateReadingTime(html);

        expect(readingTime).toBe(1);
      });
    });

    describe('countWords', () => {
      it('should count words in HTML content', () => {
        const html = '<p>This is a test paragraph.</p><h1>Header</h1>';
        const wordCount = contentProcessor.countWords(html);

        expect(wordCount).toBe(7); // "This is a test paragraph" + "Header"
      });

      it('should ignore HTML tags when counting', () => {
        const html = '<p><strong>Bold</strong> and <em>italic</em> text.</p>';
        const wordCount = contentProcessor.countWords(html);

        expect(wordCount).toBe(4); // "Bold and italic text"
      });
    });

    describe('generateTableOfContents', () => {
      it('should generate table of contents from headings', () => {
        const html = `
          <h1 id="heading-1">Chapter 1</h1>
          <p>Content</p>
          <h2 id="heading-2">Section 1.1</h2>
          <h3 id="heading-3">Subsection</h3>
        `;

        const toc = contentProcessor.generateTableOfContents(html);

        expect(Array.isArray(toc)).toBe(true);
        expect(toc).toHaveLength(3);
        expect(toc[0]).toEqual({
          id: 'heading-1',
          text: 'Chapter 1',
          level: 1
        });
        expect(toc[1]).toEqual({
          id: 'heading-2',
          text: 'Section 1.1',
          level: 2
        });
      });

      it('should return empty array for content without headings', () => {
        const html = '<p>Just a paragraph with no headings.</p>';
        const toc = contentProcessor.generateTableOfContents(html);

        expect(toc).toEqual([]);
      });
    });

    describe('extractExcerpt', () => {
      it('should extract excerpt from HTML content', () => {
        const html = '<p>This is the first paragraph that should be used as excerpt.</p><p>Second paragraph.</p>';
        const excerpt = contentProcessor.extractExcerpt(html, 50);

        expect(excerpt).toContain('This is the first paragraph');
        expect(excerpt.length).toBeLessThanOrEqual(53); // 50 + "..."
      });

      it('should handle content shorter than max length', () => {
        const html = '<p>Short content.</p>';
        const excerpt = contentProcessor.extractExcerpt(html, 100);

        expect(excerpt).toBe('Short content.');
      });
    });
  });

  describe('utility methods', () => {
    describe('generateHeadingId', () => {
      it('should generate URL-friendly ID from heading text', () => {
        expect(contentProcessor.generateHeadingId('Hello World')).toBe('hello-world');
        expect(contentProcessor.generateHeadingId('Test & Development')).toBe('test-development');
        expect(contentProcessor.generateHeadingId('  Spaces  Around  ')).toBe('spaces-around');
      });
    });

    describe('getHeadingClasses', () => {
      it('should return appropriate classes for each heading level', () => {
        expect(contentProcessor.getHeadingClasses(1)).toContain('text-4xl');
        expect(contentProcessor.getHeadingClasses(2)).toContain('text-3xl');
        expect(contentProcessor.getHeadingClasses(3)).toContain('text-2xl');
      });
    });

    describe('escapeHtml', () => {
      it('should escape HTML characters', () => {
        const text = '<script>alert("test")</script>';
        const escaped = contentProcessor.escapeHtml(text);

        expect(escaped).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
      });

      it('should handle ampersands correctly', () => {
        const text = 'Tom & Jerry';
        const escaped = contentProcessor.escapeHtml(text);

        expect(escaped).toBe('Tom &amp; Jerry');
      });
    });

    describe('openList and closeList', () => {
      it('should generate correct list opening tags', () => {
        expect(contentProcessor.openList('ul')).toContain('<ul');
        expect(contentProcessor.openList('ol')).toContain('<ol');
      });

      it('should generate correct list closing tags', () => {
        expect(contentProcessor.closeList('ul')).toBe('</ul>');
        expect(contentProcessor.closeList('ol')).toBe('</ol>');
      });
    });
  });

  describe('error handling', () => {
    it('should handle block processing errors gracefully', async () => {
      const block = {
        type: 'paragraph',
        paragraph: null // Invalid structure
      };

      const result = await contentProcessor.processBlock(block);

      expect(typeof result).toBe('string');
      expect(logger.warn).not.toHaveBeenCalled(); // Should not error for valid block type
    });

    it('should handle unknown block types', async () => {
      const block = {
        type: 'unknown_block_type',
        unknown_block_type: {}
      };

      const result = await contentProcessor.processBlock(block);

      expect(result).toBe('');
      expect(logger.debug).toHaveBeenCalledWith(
        'No processor for block type: unknown_block_type'
      );
    });
  });
}); 