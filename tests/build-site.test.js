// Mock dependencies before importing
jest.mock('fs-extra');
jest.mock('handlebars');
jest.mock('../scripts/utils/logger');
jest.mock('../config/site.config', () => ({
  build: {
    contentDir: 'content',
    outputDir: 'dist',
    templatesDir: 'templates',
    staticDir: 'static'
  },
  content: {
    enableRss: true,
    enableSitemap: true
  },
  author: {
    name: 'Test Author',
    email: 'test@example.com'
  },
  site: {
    title: 'Test Site',
    url: 'https://test.com'
  }
}));

const SiteBuilder = require('../scripts/build-site');
const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');

const logger = require('../scripts/utils/logger');

describe('SiteBuilder', () => {
  let siteBuilder;
  let mockHandlebars;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger methods
    logger.timer = jest.fn(() => jest.fn());
    logger.section = jest.fn();
    logger.info = jest.fn();
    logger.debug = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.success = jest.fn();

    // Mock Handlebars
    mockHandlebars = {
      compile: jest.fn().mockReturnValue(jest.fn().mockReturnValue('<html>Mock Template</html>')),
      registerHelper: jest.fn()
    };
    Handlebars.create = jest.fn().mockReturnValue(mockHandlebars);

    // Mock fs-extra
    fs.ensureDirSync = jest.fn();
    fs.pathExists = jest.fn().mockResolvedValue(true);
    fs.readFile = jest.fn().mockResolvedValue('<html>{{content}}</html>');
    fs.readJson = jest.fn().mockResolvedValue({ posts: [] });
    fs.writeFile = jest.fn().mockResolvedValue();
    fs.copy = jest.fn().mockResolvedValue();

    siteBuilder = new SiteBuilder();
  });

  describe('constructor', () => {
    it('should initialize with default paths', () => {
      expect(siteBuilder.contentDir).toContain('content');
      expect(siteBuilder.outputDir).toContain('dist');
      expect(siteBuilder.templatesDir).toContain('templates');
      expect(siteBuilder.staticDir).toContain('static');
    });

    it('should initialize with custom options', () => {
      const customBuilder = new SiteBuilder({ force: true });
      expect(customBuilder.force).toBe(true);
    });

    it('should ensure output directory exists', () => {
      expect(fs.ensureDirSync).toHaveBeenCalledWith(
        expect.stringContaining('dist')
      );
    });

    it('should initialize Handlebars', () => {
      expect(Handlebars.create).toHaveBeenCalled();
    });
  });

  describe('loadTemplates', () => {
    beforeEach(() => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.includes('.html'));
      });
    });

    it('should load all template files', async () => {
      await siteBuilder.loadTemplates();

      expect(fs.readFile).toHaveBeenCalledTimes(4); // base, home, blog-list, blog-post
      expect(mockHandlebars.compile).toHaveBeenCalledTimes(4);
      expect(siteBuilder.templates).toHaveProperty('base');
      expect(siteBuilder.templates).toHaveProperty('home');
      expect(siteBuilder.templates).toHaveProperty('blog-list');
      expect(siteBuilder.templates).toHaveProperty('blog-post');
    });

    it('should warn about missing templates', async () => {
      fs.pathExists.mockResolvedValue(false);

      await siteBuilder.loadTemplates();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Template not found')
      );
    });
  });

  describe('loadContent', () => {
    beforeEach(() => {
      fs.readJson.mockImplementation((path) => {
        if (path.includes('posts-index.json')) {
          return Promise.resolve({
            posts: [
              { id: '1', title: 'Post 1', category: 'Tech' },
              { id: '2', title: 'Post 2', category: 'Life' }
            ]
          });
        }
        if (path.includes('scheduled-index.json')) {
          return Promise.resolve({
            posts: [{ id: '3', title: 'Scheduled Post' }]
          });
        }
        if (path.includes('categories')) {
          return Promise.resolve({
            categories: ['Tech', 'Life']
          });
        }
        if (path.includes('tags-index.json')) {
          return Promise.resolve({
            tags: ['javascript', 'productivity']
          });
        }
        return Promise.resolve({});
      });
    });

    it('should load all content types', async () => {
      const content = await siteBuilder.loadContent();

      expect(content.publishedPosts).toHaveLength(2);
      expect(content.scheduledPosts).toHaveLength(1);
      expect(content.categories).toEqual(['Tech', 'Life']);
      expect(content.tags).toEqual(['javascript', 'productivity']);
    });

    it('should handle missing content files gracefully', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.readJson.mockRejectedValue(new Error('File not found'));

      const content = await siteBuilder.loadContent();

      expect(content.publishedPosts).toEqual([]);
      expect(content.scheduledPosts).toEqual([]);
    });
  });

  describe('copyStaticAssets', () => {
    it('should copy static assets when directory exists', async () => {
      fs.pathExists.mockResolvedValue(true);

      await siteBuilder.copyStaticAssets();

      expect(fs.copy).toHaveBeenCalledWith(
        expect.stringContaining('static'),
        expect.stringContaining('dist'),
        expect.objectContaining({
          overwrite: true,
          filter: expect.any(Function)
        })
      );
      expect(logger.success).toHaveBeenCalledWith('Static assets copied');
    });

    it('should handle missing static directory', async () => {
      fs.pathExists.mockResolvedValue(false);

      await siteBuilder.copyStaticAssets();

      expect(fs.copy).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('No static assets directory found');
    });

    it('should filter hidden files', async () => {
      fs.pathExists.mockResolvedValue(true);

      await siteBuilder.copyStaticAssets();

      const copyCall = fs.copy.mock.calls[0];
      const filterFn = copyCall[2].filter;

      expect(filterFn('/path/to/.hidden')).toBe(false);
      expect(filterFn('/path/to/visible.js')).toBe(true);
    });
  });

  describe('generateHomePage', () => {
    beforeEach(() => {
      siteBuilder.templates = {
        home: jest.fn().mockReturnValue('<div>Home Content</div>'),
        base: jest.fn().mockReturnValue('<html><body>{{content}}</body></html>')
      };
    });

    it('should generate home page with featured and recent posts', async () => {
      const content = {
        publishedPosts: [
          { id: '1', title: 'Post 1', featured: true },
          { id: '2', title: 'Post 2', featured: false },
          { id: '3', title: 'Post 3', featured: true }
        ],
        scheduledPosts: [
          { id: '4', title: 'Scheduled Post' }
        ]
      };

      await siteBuilder.generateHomePage(content);

      expect(siteBuilder.templates.home).toHaveBeenCalledWith({
        author: expect.any(Object),
        featuredPosts: expect.arrayContaining([
          expect.objectContaining({ featured: true })
        ]),
        recentPosts: expect.any(Array),
        scheduledPosts: expect.any(Array)
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        expect.any(String)
      );
    });
  });

  describe('generateBlogPages', () => {
    beforeEach(() => {
      siteBuilder.templates = {
        'blog-list': jest.fn().mockReturnValue('<div>Blog List</div>'),
        base: jest.fn().mockReturnValue('<html>{{content}}</html>')
      };
    });

    it('should generate main blog page', async () => {
      const content = {
        publishedPosts: [
          { id: '1', title: 'Post 1' },
          { id: '2', title: 'Post 2' }
        ]
      };

      await siteBuilder.generateBlogPages(content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('blog/index.html'),
        expect.any(String)
      );
    });

    it('should generate paginated blog pages for large post counts', async () => {
      const posts = Array.from({ length: 25 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Post ${i + 1}`
      }));

      const content = { publishedPosts: posts };

      await siteBuilder.generateBlogPages(content);

      // Should generate multiple pages (page 1, page 2, etc.)
      expect(fs.writeFile).toHaveBeenCalledTimes(3); // Main + 2 paginated pages
    });
  });

  describe('generatePostPages', () => {
    beforeEach(() => {
      siteBuilder.templates = {
        'blog-post': jest.fn().mockReturnValue('<article>Post Content</article>'),
        base: jest.fn().mockReturnValue('<html>{{content}}</html>')
      };

      // Mock related posts functionality
      siteBuilder.findRelatedPosts = jest.fn().mockReturnValue([]);
    });

    it('should generate individual post pages', async () => {
      const content = {
        publishedPosts: [
          {
            id: '1',
            slug: 'test-post',
            title: 'Test Post',
            content: '<p>Post content</p>',
            category: 'Tech'
          }
        ]
      };

      await siteBuilder.generatePostPages(content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('blog/test-post.html'),
        expect.any(String)
      );

      expect(siteBuilder.templates['blog-post']).toHaveBeenCalledWith(
        expect.objectContaining({
          post: expect.objectContaining({
            slug: 'test-post',
            title: 'Test Post'
          })
        })
      );
    });
  });

  describe('generateCategoryPages', () => {
    beforeEach(() => {
      siteBuilder.templates = {
        'blog-list': jest.fn().mockReturnValue('<div>Category List</div>'),
        base: jest.fn().mockReturnValue('<html>{{content}}</html>')
      };
    });

    it('should generate category pages', async () => {
      const content = {
        publishedPosts: [
          { id: '1', title: 'Tech Post', category: 'Tech' },
          { id: '2', title: 'Life Post', category: 'Life' },
          { id: '3', title: 'Another Tech Post', category: 'Tech' }
        ]
      };

      await siteBuilder.generateCategoryPages(content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('category/tech.html'),
        expect.any(String)
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('category/life.html'),
        expect.any(String)
      );
    });
  });

  describe('generateRSSFeed', () => {
    it('should generate RSS feed for published posts', async () => {
      const posts = [
        {
          title: 'Test Post',
          excerpt: 'Test excerpt',
          publishDate: '2024-01-01',
          slug: 'test-post',
          author: 'Test Author'
        }
      ];

      await siteBuilder.generateRSSFeed(posts);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('rss.xml'),
        expect.stringContaining('<?xml')
      );
    });

    it('should handle empty posts array', async () => {
      await siteBuilder.generateRSSFeed([]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('rss.xml'),
        expect.any(String)
      );
    });
  });

  describe('generateSitemap', () => {
    it('should generate sitemap with all pages', async () => {
      const content = {
        publishedPosts: [
          { slug: 'post-1', lastEditedTime: '2024-01-01' },
          { slug: 'post-2', lastEditedTime: '2024-01-02' }
        ]
      };

      await siteBuilder.generateSitemap(content);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('sitemap.xml'),
        expect.any(String)
      );
    });
  });

  describe('findRelatedPosts', () => {
    it('should find related posts by tags and category', () => {
      const currentPost = {
        id: '1',
        tags: ['javascript', 'react'],
        category: 'Tech'
      };

      const allPosts = [
        { id: '2', tags: ['javascript', 'vue'], category: 'Tech' },
        { id: '3', tags: ['python'], category: 'Tech' },
        { id: '4', tags: ['javascript'], category: 'Life' },
        { id: '5', tags: ['design'], category: 'Design' }
      ];

      const related = siteBuilder.findRelatedPosts(currentPost, allPosts, 2);

      expect(related).toHaveLength(2);
      expect(related[0].id).toBe('2'); // Highest score (same category + shared tag)
      expect(related[1].id).toBe('3'); // Second highest (same category)
    });

    it('should exclude the current post from results', () => {
      const currentPost = { id: '1', tags: ['test'], category: 'Tech' };
      const allPosts = [currentPost, { id: '2', tags: ['test'], category: 'Tech' }];

      const related = siteBuilder.findRelatedPosts(currentPost, allPosts);

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('2');
    });
  });

  describe('getBaseTemplateData', () => {
    it('should return base template data', () => {
      const data = siteBuilder.getBaseTemplateData();

      expect(data).toHaveProperty('site');
      expect(data).toHaveProperty('author');
      expect(data).toHaveProperty('currentYear');
      expect(data.currentYear).toBe(new Date().getFullYear());
    });
  });

  describe('slugify', () => {
    it('should convert text to URL-friendly slug', () => {
      expect(siteBuilder.slugify('Hello World')).toBe('hello-world');
      expect(siteBuilder.slugify('Test & Development')).toBe('test-development');
      expect(siteBuilder.slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });
  });

  describe('build', () => {
    beforeEach(() => {
      siteBuilder.loadTemplates = jest.fn().mockResolvedValue();
      siteBuilder.loadContent = jest.fn().mockResolvedValue({
        publishedPosts: [{ id: '1' }],
        scheduledPosts: [{ id: '2' }]
      });
      siteBuilder.copyStaticAssets = jest.fn().mockResolvedValue();
      siteBuilder.generateHomePage = jest.fn().mockResolvedValue();
      siteBuilder.generateBlogPages = jest.fn().mockResolvedValue();
      siteBuilder.generatePostPages = jest.fn().mockResolvedValue();
      siteBuilder.generateCategoryPages = jest.fn().mockResolvedValue();
      siteBuilder.generateRSSFeed = jest.fn().mockResolvedValue();
      siteBuilder.generateSitemap = jest.fn().mockResolvedValue();
    });

    it('should execute full build process successfully', async () => {
      const result = await siteBuilder.build();

      expect(siteBuilder.loadTemplates).toHaveBeenCalled();
      expect(siteBuilder.loadContent).toHaveBeenCalled();
      expect(siteBuilder.copyStaticAssets).toHaveBeenCalled();
      expect(siteBuilder.generateHomePage).toHaveBeenCalled();
      expect(siteBuilder.generateBlogPages).toHaveBeenCalled();
      expect(siteBuilder.generatePostPages).toHaveBeenCalled();
      expect(siteBuilder.generateCategoryPages).toHaveBeenCalled();

      expect(result).toEqual({
        totalPages: 0,
        publishedPosts: 1,
        scheduledPosts: 1
      });

      expect(logger.success).toHaveBeenCalledWith('Site build completed successfully!');
    });

    it('should handle build errors gracefully', async () => {
      siteBuilder.loadTemplates.mockRejectedValue(new Error('Template load failed'));

      await expect(siteBuilder.build()).rejects.toThrow('Template load failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Site build failed',
        expect.any(Error)
      );
    });

    it('should conditionally generate RSS and sitemap based on config', async () => {
      // Mock config to disable RSS and sitemap
      jest.doMock('../config/site.config', () => ({
        content: {
          enableRss: false,
          enableSitemap: false
        }
      }));

      await siteBuilder.build();

      expect(siteBuilder.generateRSSFeed).not.toHaveBeenCalled();
      expect(siteBuilder.generateSitemap).not.toHaveBeenCalled();
    });
  });

  describe('setupHandlebarsHelpers', () => {
    beforeEach(() => {
      mockHandlebars.registerHelper = jest.fn();
    });

    it('should register Handlebars helpers', () => {
      siteBuilder.setupHandlebarsHelpers();

      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith(
        'formatDate',
        expect.any(Function)
      );
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith(
        'eq',
        expect.any(Function)
      );
      expect(mockHandlebars.registerHelper).toHaveBeenCalledWith(
        'truncate',
        expect.any(Function)
      );
    });
  });

  describe('error handling', () => {
    it('should handle template loading errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File read failed'));

      await siteBuilder.loadTemplates();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle content loading errors', async () => {
      fs.readJson.mockRejectedValue(new Error('JSON parse failed'));

      const content = await siteBuilder.loadContent();

      expect(content.publishedPosts).toEqual([]);
    });
  });
}); 