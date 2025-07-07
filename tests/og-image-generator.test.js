// Mock dependencies
jest.mock('fs-extra');
jest.mock('sharp');
jest.mock('../scripts/utils/logger');

const OGImageGenerator = require('../scripts/utils/og-image-generator');
const fs = require('fs-extra');
const sharp = require('sharp');
const logger = require('../scripts/utils/logger');

// Mock config
const mockConfig = {
  site: {
    title: 'Test Blog',
    description: 'Test blog description'
  },
  author: {
    name: 'Test Author'
  },
  build: {
    outputDir: 'dist'
  }
};

describe('OGImageGenerator', () => {
  let generator;
  let mockSharp;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger methods
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock fs-extra methods
    fs.ensureDir = jest.fn().mockResolvedValue();
    fs.pathExists = jest.fn().mockResolvedValue(false);
    fs.readdir = jest.fn().mockResolvedValue([]);
    fs.remove = jest.fn().mockResolvedValue();

    // Mock Sharp
    mockSharp = {
      composite: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({ width: 1200, height: 630 })
    };
    sharp.mockReturnValue(mockSharp);

    generator = new OGImageGenerator(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct dimensions and paths', () => {
      expect(generator.width).toBe(1200);
      expect(generator.height).toBe(630);
      expect(generator.outputDir).toContain('og-images');
    });
  });

  describe('initialize', () => {
    it('should ensure output directory exists', async () => {
      await generator.initialize();
      
      expect(fs.ensureDir).toHaveBeenCalledWith(generator.outputDir);
      expect(logger.debug).toHaveBeenCalledWith('OG image output directory ensured');
    });
  });

  describe('generatePostImage', () => {
    const mockPost = {
      slug: 'test-post',
      title: 'Test Post Title',
      category: 'Blog',
      readingTime: 5
    };

    it('should generate OG image for post', async () => {
      const result = await generator.generatePostImage(mockPost);
      
      expect(result).toBe('/og-images/post-test-post.png');
      expect(sharp).toHaveBeenCalled();
      expect(mockSharp.composite).toHaveBeenCalled();
      expect(mockSharp.png).toHaveBeenCalled();
      expect(mockSharp.toFile).toHaveBeenCalled();
    });

    it('should skip generation if image exists and not forcing', async () => {
      fs.pathExists.mockResolvedValue(true);
      
      const result = await generator.generatePostImage(mockPost);
      
      expect(result).toBe('/og-images/post-test-post.png');
      expect(logger.debug).toHaveBeenCalledWith('OG image already exists: post-test-post.png');
      expect(mockSharp.toFile).not.toHaveBeenCalled();
    });

    it('should force regeneration when option is set', async () => {
      fs.pathExists.mockResolvedValue(true);
      
      const result = await generator.generatePostImage(mockPost, { forceRegenerate: true });
      
      expect(result).toBe('/og-images/post-test-post.png');
      expect(mockSharp.toFile).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockSharp.toFile.mockRejectedValue(new Error('Sharp error'));
      
      const result = await generator.generatePostImage(mockPost);
      
      expect(result).toBe('/images/avatar.png'); // Fallback
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generateCategoryImage', () => {
    const mockCategory = {
      slug: 'blog',
      name: 'Blog',
      description: 'Blog posts'
    };

    it('should generate OG image for category', async () => {
      const result = await generator.generateCategoryImage(mockCategory);
      
      expect(result).toBe('/og-images/category-blog.png');
      expect(sharp).toHaveBeenCalled();
      expect(mockSharp.composite).toHaveBeenCalled();
      expect(mockSharp.toFile).toHaveBeenCalled();
    });

    it('should skip if image already exists', async () => {
      fs.pathExists.mockResolvedValue(true);
      
      const result = await generator.generateCategoryImage(mockCategory);
      
      expect(result).toBe('/og-images/category-blog.png');
      expect(mockSharp.toFile).not.toHaveBeenCalled();
    });
  });

  describe('generateDefaultImage', () => {
    it('should generate default OG image', async () => {
      const result = await generator.generateDefaultImage();
      
      expect(result).toBe('/og-images/default.png');
      expect(sharp).toHaveBeenCalled();
      expect(mockSharp.composite).toHaveBeenCalled();
      expect(mockSharp.toFile).toHaveBeenCalled();
    });

    it('should skip if default image exists', async () => {
      fs.pathExists.mockResolvedValue(true);
      
      const result = await generator.generateDefaultImage();
      
      expect(result).toBe('/og-images/default.png');
      expect(mockSharp.toFile).not.toHaveBeenCalled();
    });
  });

  describe('createWrappedText', () => {
    it('should wrap long text into multiple lines', () => {
      const longText = 'This is a very long title that should be wrapped into multiple lines';
      const result = generator.createWrappedText(longText, 60, 160, 52, '#000000', 800);
      
      expect(result).toContain('<text');
      expect(result).toContain('This is a very long title');
    });

    it('should limit to 3 lines maximum', () => {
      const veryLongText = 'This is an extremely long title that would normally wrap into many lines but should be limited to just three lines maximum with ellipsis at the end';
      const result = generator.createWrappedText(veryLongText, 60, 160, 52, '#000000', 600);
      
      const lines = result.split('<text').length - 1; // Count text elements
      expect(lines).toBeLessThanOrEqual(3);
      expect(result).toContain('...');
    });
  });

  describe('escapeXml', () => {
    it('should escape XML special characters', () => {
      const text = 'Title with "quotes" & <tags>';
      const escaped = generator.escapeXml(text);
      
      expect(escaped).toBe('Title with &quot;quotes&quot; &amp; &lt;tags&gt;');
    });

    it('should handle empty/null text', () => {
      expect(generator.escapeXml('')).toBe('');
      expect(generator.escapeXml(null)).toBe('');
      expect(generator.escapeXml(undefined)).toBe('');
    });
  });

  describe('cleanupOldImages', () => {
    it('should remove images for non-existent posts', async () => {
      fs.readdir.mockResolvedValue([
        'post-existing-post.png',
        'post-old-post.png',
        'category-blog.png',
        'default.png'
      ]);

      const currentSlugs = ['existing-post'];
      
      await generator.cleanupOldImages(currentSlugs);
      
      expect(fs.remove).toHaveBeenCalledWith(
        expect.stringContaining('post-old-post.png')
      );
      expect(fs.remove).not.toHaveBeenCalledWith(
        expect.stringContaining('post-existing-post.png')
      );
      expect(fs.remove).not.toHaveBeenCalledWith(
        expect.stringContaining('category-blog.png')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory error'));
      
      await generator.cleanupOldImages(['test']);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to cleanup old OG images',
        expect.any(Error)
      );
    });
  });

  describe('getFallbackImage', () => {
    it('should return fallback image path', () => {
      const fallback = generator.getFallbackImage();
      expect(fallback).toBe('/images/avatar.png');
    });
  });
}); 