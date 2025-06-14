#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const handlebars = require('handlebars');
const { SitemapStream, streamToPromise } = require('sitemap');
const RSS = require('rss');
const { parseISO, format } = require('date-fns');
const logger = require('./utils/logger');
const config = require('../config/site.config');

/**
 * Build cache for incremental builds
 */
class BuildCache {
  constructor() {
    this.cacheFile = path.join(process.cwd(), '.build-cache.json');
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        return fs.readJsonSync(this.cacheFile);
      }
    } catch (error) {
      logger.warn('Failed to load build cache, starting fresh', error);
    }
    
    return {
      lastBuild: null,
      fileHashes: {},
      generatedFiles: {},
      buildVersion: '2.0'
    };
  }

  saveCache() {
    try {
      fs.writeJsonSync(this.cacheFile, this.cache, { spaces: 2 });
    } catch (error) {
      logger.warn('Failed to save build cache', error);
    }
  }

  getFileHash(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return `${stats.mtime.getTime()}-${stats.size}`;
    } catch (error) {
      return null;
    }
  }

  hasFileChanged(filePath) {
    const currentHash = this.getFileHash(filePath);
    const cachedHash = this.cache.fileHashes[filePath];
    
    if (currentHash !== cachedHash) {
      this.cache.fileHashes[filePath] = currentHash;
      return true;
    }
    
    return false;
  }

  markFileGenerated(filePath, dependencies = []) {
    this.cache.generatedFiles[filePath] = {
      timestamp: Date.now(),
      dependencies: dependencies
    };
  }

  shouldRebuildFile(filePath, dependencies = []) {
    const fileInfo = this.cache.generatedFiles[filePath];
    
    // Always rebuild if file doesn't exist or not in cache
    if (!fs.existsSync(filePath) || !fileInfo) {
      return true;
    }

    // Check if any dependencies have changed
    for (const dep of dependencies) {
      if (this.hasFileChanged(dep)) {
        logger.debug(`Dependency changed: ${dep}, rebuilding ${filePath}`);
        return true;
      }
    }

    return false;
  }
}

/**
 * Static site builder that generates HTML from processed content
 */
class SiteBuilder {
  constructor(options = {}) {
    this.contentDir = path.join(process.cwd(), config.build.contentDir);
    this.outputDir = path.join(process.cwd(), config.build.outputDir);
    this.templatesDir = path.join(process.cwd(), config.build.templatesDir);
    this.staticDir = path.join(process.cwd(), config.build.staticDir);
    this.force = options.force || false;
    
    // Ensure output directory exists
    fs.ensureDirSync(this.outputDir);
    
    // Initialize Handlebars
    this.handlebars = handlebars.create();
    this.setupHandlebarsHelpers();
    
    this.templates = {};
    this.pageCount = 0;
    this.buildCache = new BuildCache();
    
    // Performance tracking
    this.performanceMetrics = {
      startTime: Date.now(),
      templatesLoaded: 0,
      pagesGenerated: 0,
      filesSkipped: 0,
      cacheHits: 0
    };
  }

  /**
   * Main build method with incremental optimization
   */
  async build() {
    const buildTimer = logger.timer('Site build');
    
    try {
      logger.section('🏗️  Starting Optimized Site Build');
      
      // Track build start
      this.performanceMetrics.startTime = Date.now();
      
      // Load templates (with caching)
      await this.loadTemplates();
      
      // Load content
      const content = await this.loadContent();
      
      // Copy static assets (only if changed)
      await this.copyStaticAssetsIncremental();
      
      // Generate pages with incremental builds
      await this.generateHomePage(content);
      await this.generateBlogPages(content);
      await this.generatePostPages(content);
      await this.generateCategoryPages(content);
      
      // Generate feeds and sitemaps (only if content changed)
      if (config.content.enableRss) {
        await this.generateRSSFeedIncremental(content.publishedPosts);
      }
      
      if (config.content.enableSitemap) {
        await this.generateSitemapIncremental(content);
      }
      
      // Update build cache
      this.buildCache.cache.lastBuild = Date.now();
      this.buildCache.saveCache();
      
      // Log performance metrics
      const totalTime = Date.now() - this.performanceMetrics.startTime;
      logger.success('🚀 Optimized site build completed!');
      logger.info('📊 Build Performance Summary:');
      logger.info(`   Total time: ${totalTime}ms`);
      logger.info(`   Pages generated: ${this.performanceMetrics.pagesGenerated}`);
      logger.info(`   Files skipped (cached): ${this.performanceMetrics.filesSkipped}`);
      logger.info(`   Cache hit rate: ${Math.round((this.performanceMetrics.cacheHits / (this.performanceMetrics.pagesGenerated + this.performanceMetrics.filesSkipped)) * 100)}%`);
      logger.info(`   Templates loaded: ${this.performanceMetrics.templatesLoaded}`);
      
      buildTimer();
      
      return {
        totalPages: this.pageCount || 0,
        publishedPosts: content.publishedPosts.length,
        scheduledPosts: content.scheduledPosts.length,
        performance: {
          totalTime,
          pagesGenerated: this.performanceMetrics.pagesGenerated,
          filesSkipped: this.performanceMetrics.filesSkipped,
          cacheHitRate: Math.round((this.performanceMetrics.cacheHits / (this.performanceMetrics.pagesGenerated + this.performanceMetrics.filesSkipped)) * 100)
        }
      };
      
    } catch (error) {
      logger.error('Site build failed', error);
      throw error;
    }
  }

  /**
   * Load templates with caching
   */
  async loadTemplates() {
    logger.info('📄 Loading templates...');
    
    const templateFiles = [
      'base.html',
      'home.html', 
      'blog-list.html',
      'blog-post.html'
    ];

    let templatesChanged = false;
    
    for (const templateFile of templateFiles) {
      const templatePath = path.join(this.templatesDir, templateFile);
      
      if (this.buildCache.hasFileChanged(templatePath)) {
        templatesChanged = true;
        logger.debug(`Template changed: ${templateFile}`);
      }
      
      if (fs.existsSync(templatePath)) {
        const templateContent = await fs.readFile(templatePath, 'utf8');
        const templateName = path.basename(templateFile, '.html');
        this.templates[templateName] = this.handlebars.compile(templateContent);
        this.performanceMetrics.templatesLoaded++;
      }
    }

    // If templates changed, force rebuild of all pages
    if (templatesChanged && !this.force) {
      logger.info('🔄 Templates changed, forcing full rebuild');
      this.force = true;
    }

    logger.success(`Loaded ${this.performanceMetrics.templatesLoaded} templates`);
  }

  /**
   * Load all content from the content directory
   */
  async loadContent() {
    logger.info('Loading content...');
    
    const content = {
      publishedPosts: [],
      scheduledPosts: [],
      draftPosts: [],
      categories: [],
      tags: []
    };
    
    // Load posts index
    const postsIndexPath = path.join(this.contentDir, 'posts-index.json');
    if (await fs.pathExists(postsIndexPath)) {
      const postsIndex = await fs.readJson(postsIndexPath);
      content.publishedPosts = postsIndex.posts || [];
    }
    
    // Load scheduled posts
    const scheduledIndexPath = path.join(this.contentDir, 'scheduled-index.json');
    if (await fs.pathExists(scheduledIndexPath)) {
      const scheduledIndex = await fs.readJson(scheduledIndexPath);
      content.scheduledPosts = scheduledIndex.posts || [];
    }
    
    // Load categories with proper error handling
    const categoriesIndexPath = path.join(this.contentDir, 'categories', 'index.json');
    if (await fs.pathExists(categoriesIndexPath)) {
      try {
      const categoriesIndex = await fs.readJson(categoriesIndexPath);
        // Ensure categories is always an array
        if (categoriesIndex && Array.isArray(categoriesIndex.categories)) {
          content.categories = categoriesIndex.categories;
        } else {
          logger.warn('Categories index exists but does not contain valid array structure');
          content.categories = [];
        }
      } catch (error) {
        logger.warn('Failed to parse categories index, using empty array', error);
        content.categories = [];
      }
    } else {
      logger.debug('Categories index not found, using empty array');
      content.categories = [];
    }
    
    // Load tags
    const tagsIndexPath = path.join(this.contentDir, 'tags-index.json');
    if (await fs.pathExists(tagsIndexPath)) {
      try {
      const tagsIndex = await fs.readJson(tagsIndexPath);
      content.tags = tagsIndex.tags || [];
      } catch (error) {
        logger.warn('Failed to parse tags index, using empty array', error);
        content.tags = [];
      }
    }
    
    logger.success(`Loaded ${content.publishedPosts.length} published posts, ${content.scheduledPosts.length} scheduled posts`);
    return content;
  }

  /**
   * Copy static assets to output directory
   */
  async copyStaticAssets() {
    logger.info('Copying static assets...');
    
    if (await fs.pathExists(this.staticDir)) {
      await fs.copy(this.staticDir, this.outputDir, {
        overwrite: true,
        filter: (src) => {
          // Skip hidden files and directories
          return !path.basename(src).startsWith('.');
        }
      });
      logger.success('Static assets copied');
    } else {
      logger.info('No static assets directory found');
    }
  }

  /**
   * Copy static assets to output directory (incremental)
   */
  async copyStaticAssetsIncremental() {
    logger.info('📁 Copying static assets...');
    
    if (!await fs.pathExists(this.staticDir)) {
      logger.warn('Static directory not found, skipping asset copy');
      return;
    }

    const staticFiles = await this.getAllFiles(this.staticDir);
    let copiedCount = 0;
    let skippedCount = 0;

    for (const file of staticFiles) {
      const relativePath = path.relative(this.staticDir, file);
      const outputPath = path.join(this.outputDir, relativePath);
      
      // Check if file needs to be copied
      if (this.force || this.buildCache.shouldRebuildFile(outputPath, [file])) {
        await fs.ensureDir(path.dirname(outputPath));
        await fs.copy(file, outputPath);
        this.buildCache.markFileGenerated(outputPath, [file]);
        copiedCount++;
        this.performanceMetrics.pagesGenerated++;
      } else {
        skippedCount++;
        this.performanceMetrics.filesSkipped++;
        this.performanceMetrics.cacheHits++;
      }
    }

    logger.success(`Static assets: ${copiedCount} copied, ${skippedCount} skipped (cached)`);
  }

  /**
   * Get all files recursively from a directory
   */
  async getAllFiles(dir) {
    const files = [];
    
    async function traverse(currentDir) {
      const items = await fs.readdir(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          await traverse(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
    
    await traverse(dir);
    return files;
  }

  /**
   * Generate RSS feed (incremental)
   */
  async generateRSSFeedIncremental(posts) {
    const rssPath = path.join(this.outputDir, 'rss.xml');
    const contentPaths = posts.map(post => path.join(this.contentDir, 'posts', `${post.slug}.json`));
    
    if (!this.force && !this.buildCache.shouldRebuildFile(rssPath, contentPaths)) {
      logger.debug('RSS feed unchanged, skipping');
      this.performanceMetrics.filesSkipped++;
      this.performanceMetrics.cacheHits++;
      return;
    }

    await this.generateRSSFeed(posts);
    this.buildCache.markFileGenerated(rssPath, contentPaths);
    this.performanceMetrics.pagesGenerated++;
  }

  /**
   * Generate sitemap (incremental)
   */
  async generateSitemapIncremental(content) {
    const sitemapPath = path.join(this.outputDir, 'sitemap.xml');
    const contentPaths = [
      ...content.publishedPosts.map(post => path.join(this.contentDir, 'posts', `${post.slug}.json`)),
      path.join(this.contentDir, 'posts-index.json')
    ];
    
    if (!this.force && !this.buildCache.shouldRebuildFile(sitemapPath, contentPaths)) {
      logger.debug('Sitemap unchanged, skipping');
      this.performanceMetrics.filesSkipped++;
      this.performanceMetrics.cacheHits++;
      return;
    }

    await this.generateSitemap(content);
    this.buildCache.markFileGenerated(sitemapPath, contentPaths);
    this.performanceMetrics.pagesGenerated++;
  }

  /**
   * Generate the home page
   */
  async generateHomePage(content) {
    logger.info('Generating home page...');
    
    const featuredPosts = content.publishedPosts
      .filter(post => post.featured)
      .slice(0, 3);
    
    const recentPosts = content.publishedPosts
      .slice(0, 5);
    
    const baseData = this.getBaseTemplateData();
    const homeContent = this.templates.home({
      author: baseData.author,
      featuredPosts,
      recentPosts,
      scheduledPosts: content.scheduledPosts.slice(0, 3)
    });
    
    const homeHtml = this.templates.base({
      ...this.getBaseTemplateData(),
      content: homeContent,
      isHome: true,
      pageTitle: null, // Use site title only
      description: config.site.description
    });
    
    await fs.writeFile(path.join(this.outputDir, 'index.html'), homeHtml);
    logger.success('Home page generated');
  }

  /**
   * Generate blog listing pages
   */
  async generateBlogPages(content) {
    logger.info('Generating blog pages...');
    
    // Main blog page (all posts)
    await this.generateBlogListingPage(content.publishedPosts, '/blog', 'index.html', content);
    
    // Category pages - ensure categories is iterable
    const categories = Array.isArray(content.categories) ? content.categories : [];
    
    if (categories.length === 0) {
      logger.debug('No categories found, skipping category page generation');
      return;
    }
    
    for (const category of categories) {
      // Validate category structure
      if (!category || typeof category !== 'object' || !category.name || !category.slug) {
        logger.warn('Invalid category structure found, skipping:', category);
        continue;
      }
      
      const categoryPosts = content.publishedPosts.filter(post => 
        post.category === category.name
      );
      
      const categoryDir = path.join(this.outputDir, category.slug);
      await fs.ensureDir(categoryDir);
      
      await this.generateBlogListingPage(
        categoryPosts, 
        `/${category.slug}`, 
        path.join(categoryDir, 'index.html'),
        content,
        {
          categoryFilter: category.slug,
          categoryName: category.name,
          categoryDescription: config.categories[category.slug]?.description || ''
        }
      );
    }
    
    logger.success('Blog listing pages generated');
  }

  /**
   * Generate a blog listing page with pagination
   */
  async generateBlogListingPage(posts, urlPath, outputPath, content, extraData = {}) {
    const postsPerPage = config.content.postsPerPage;
    const totalPages = Math.ceil(posts.length / postsPerPage);
    
    for (let page = 1; page <= totalPages; page++) {
      const startIndex = (page - 1) * postsPerPage;
      const endIndex = startIndex + postsPerPage;
      const pagePosts = posts.slice(startIndex, endIndex);
      
      const pagination = totalPages > 1 ? {
        current: page,
        total: totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevUrl: page === 2 ? urlPath : `${urlPath}/page/${page - 1}`,
        nextUrl: `${urlPath}/page/${page + 1}`
      } : null;
      
      const blogContent = this.templates['blog-list']({
        posts: pagePosts,
        pagination,
        categories: content.categories || [],
        popularTags: (content.tags || []).slice(0, 10),
        showCategoriesFilter: true,
        showTagsCloud: true,
        ...extraData
      });
      
      const pageTitle = page === 1 
        ? (extraData.categoryName || 'Blog')
        : `${extraData.categoryName || 'Blog'} - Page ${page}`;
      
      const blogHtml = this.templates.base({
        ...this.getBaseTemplateData(),
        content: blogContent,
        isBlog: !extraData.categoryFilter,
        isResearch: extraData.categoryFilter === 'research-notes',
        isMath: extraData.categoryFilter === 'math',
        pageTitle,
        description: extraData.categoryDescription || `${config.site.title} blog posts`,
        canonicalPath: page === 1 ? urlPath : `${urlPath}/page/${page}`
      });
      
      // Determine output file path
      let finalOutputPath;
      if (page === 1) {
        finalOutputPath = typeof outputPath === 'string' ? outputPath : path.join(this.outputDir, outputPath);
      } else {
        const pageDir = path.join(path.dirname(outputPath), 'page', page.toString());
        await fs.ensureDir(pageDir);
        finalOutputPath = path.join(pageDir, 'index.html');
      }
      
      await fs.writeFile(finalOutputPath, blogHtml);
    }
  }

  /**
   * Generate individual post pages
   */
  async generatePostPages(content) {
    logger.info('Generating post pages...');
    
    const allPosts = [...content.publishedPosts, ...content.scheduledPosts];
    let generatedCount = 0;
    
    for (const post of allPosts) {
      await this.generatePostPage(post, allPosts);
      generatedCount++;
    }
    
    logger.success(`Generated ${generatedCount} post pages`);
  }

  /**
   * Generate a single post page
   */
  async generatePostPage(post, allPosts) {
    // Load full post content
    const postContentPath = path.join(this.contentDir, 'posts', `${post.slug}.json`);
    
    if (!(await fs.pathExists(postContentPath))) {
      logger.warn(`Post content not found: ${post.slug}`);
      return;
    }
    
    const fullPost = await fs.readJson(postContentPath);
    
    // Find related posts
    const relatedPosts = this.findRelatedPosts(fullPost, allPosts);
    
    // Find prev/next posts in the same category
    const categoryPosts = allPosts
      .filter(p => p.category === post.category && p.status === 'Published')
      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    
    const currentIndex = categoryPosts.findIndex(p => p.slug === post.slug);
    const prevPost = currentIndex > 0 ? categoryPosts[currentIndex - 1] : null;
    const nextPost = currentIndex < categoryPosts.length - 1 ? categoryPosts[currentIndex + 1] : null;
    
    const baseData = this.getBaseTemplateData();
    const postContent = this.templates['blog-post']({
      ...fullPost,
      author: baseData.author,
      site: config.site,
      relatedPosts,
      prevPost,
      nextPost
    });
    
    const postHtml = this.templates.base({
      ...this.getBaseTemplateData(),
      content: postContent,
      isPost: true,
      enableMath: true, // Enable math for all posts
      pageTitle: fullPost.title,
      description: fullPost.excerpt || `${fullPost.title} - ${config.site.title}`,
      canonicalPath: `/${this.slugify(fullPost.category)}/${fullPost.slug}`,
      featuredImage: fullPost.featuredImage,
      publishDate: fullPost.publishDate,
      lastEditedTime: fullPost.lastEditedTime
    });
    
    // Create category directory based on category slug
    const categorySlug = this.slugify(fullPost.category);
    const categoryDir = path.join(this.outputDir, categorySlug);
    await fs.ensureDir(categoryDir);
    
    // Write post file
    const postPath = path.join(categoryDir, `${fullPost.slug}.html`);
    await fs.writeFile(postPath, postHtml);
    
    logger.debug(`Generated post: ${fullPost.title} in /${categorySlug}/${fullPost.slug}`);
  }

  /**
   * Generate category-specific pages (including empty ones)
   */
  async generateCategoryPages(content) {
    logger.info('Generating category pages...');
    
    // Define all expected categories (including empty ones)
    const allCategories = [
      { name: 'Blog', slug: 'blog', description: 'Personal thoughts and technical insights' },
      { name: 'Research Notes', slug: 'research-notes', description: 'Research findings and academic notes' },
      { name: 'Math', slug: 'math', description: 'Mathematical explorations and problem solving' }
    ];
    
    for (const category of allCategories) {
      const categoryPosts = content.publishedPosts.filter(post => 
        post.category === category.name
      );
      
      const categoryDir = path.join(this.outputDir, category.slug);
      await fs.ensureDir(categoryDir);
      
      // Generate category listing page
      const categoryContent = this.templates['blog-list']({
        posts: categoryPosts,
        categories: content.categories,
        tags: content.tags,
        pageTitle: category.name,
        categoryName: category.name,
        categoryDescription: category.description,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        isEmpty: categoryPosts.length === 0
      });
      
      const categoryHtml = this.templates.base({
        ...this.getBaseTemplateData(),
        content: categoryContent,
        isBlog: category.slug === 'blog',
        isResearch: category.slug === 'research-notes', 
        isMath: category.slug === 'math',
        pageTitle: category.name,
        description: category.description,
        canonicalPath: `/${category.slug}`
      });
      
      const categoryIndexPath = path.join(categoryDir, 'index.html');
      await fs.writeFile(categoryIndexPath, categoryHtml);
      
      logger.debug(`Generated category page: ${category.name} (${categoryPosts.length} posts)`);
    }
    
    logger.success('Category pages generated');
  }

  /**
   * Generate RSS feed
   */
  async generateRSSFeed(posts) {
    logger.info('Generating RSS feed...');
    
    const feed = new RSS({
      title: config.site.title,
      description: config.site.description,
      feed_url: `${config.site.url}/rss.xml`,
      site_url: config.site.url,
      image_url: `${config.site.url}/favicon.ico`,
      author: config.author.name,
      managingEditor: config.author.email,
      webMaster: config.author.email,
      copyright: `© ${new Date().getFullYear()} ${config.author.name}`,
      language: config.site.language,
      categories: Object.keys(config.categories),
      pubDate: new Date(),
      ttl: 60
    });
    
    // Add posts to feed (latest 20)
    const feedPosts = posts.slice(0, 20);
    
    for (const post of feedPosts) {
      feed.item({
        title: post.title,
        description: post.excerpt || '',
        url: `${config.site.url}/${this.slugify(post.category)}/${post.slug}`,
        guid: post.id,
        categories: post.tags || [],
        author: config.author.name,
        date: post.publishDate
      });
    }
    
    const rssXml = feed.xml({ indent: true });
    await fs.writeFile(path.join(this.outputDir, 'rss.xml'), rssXml);
    
    logger.success('RSS feed generated');
  }

  /**
   * Generate sitemap
   */
  async generateSitemap(content) {
    logger.info('Generating sitemap...');
    
    const links = [];
    
    // Add home page
    links.push({
      url: '/',
      changefreq: 'weekly',
      priority: 1.0
    });
    
    // Add category pages - ensure categories is iterable
    const categories = Array.isArray(content.categories) ? content.categories : [];
    for (const category of categories) {
      if (!category || !category.slug) {
        logger.warn('Invalid category structure in sitemap generation, skipping:', category);
        continue;
      }
      
      links.push({
        url: `/${category.slug}/`,
        changefreq: 'weekly',
        priority: 0.8
      });
    }
    
    // Add posts
    for (const post of content.publishedPosts) {
      links.push({
        url: `/${this.slugify(post.category)}/${post.slug}`,
        changefreq: 'monthly',
        priority: 0.6,
        lastmod: post.lastEditedTime
      });
    }
    
    const sitemapStream = new SitemapStream({ 
      hostname: config.site.url,
      cacheTime: 600000 // 10 minutes
    });
    
    links.forEach(link => sitemapStream.write(link));
    sitemapStream.end();
    
    const sitemap = await streamToPromise(sitemapStream);
    await fs.writeFile(path.join(this.outputDir, 'sitemap.xml'), sitemap);
    
    logger.success('Sitemap generated');
  }

  /**
   * Find related posts based on tags and category
   */
  findRelatedPosts(currentPost, allPosts, maxResults = 3) {
    const publishedPosts = allPosts.filter(post => 
      post.status === 'Published' && post.slug !== currentPost.slug
    );
    
    const scored = publishedPosts.map(post => {
      let score = 0;
      
      // Same category gets higher score
      if (post.category === currentPost.category) {
        score += 3;
      }
      
      // Shared tags get points
      if (currentPost.tags && post.tags) {
        const sharedTags = currentPost.tags.filter(tag => post.tags.includes(tag));
        score += sharedTags.length * 2;
      }
      
      return { post, score };
    });
    
    // Sort by score and return top results
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.post);
  }

  /**
   * Get base template data
   */
  getBaseTemplateData() {
    // Format social URLs properly
    const author = {
      ...config.author,
      social: {
        ...config.author.social
      }
    };
    
    // Format Twitter URL - handle both @username and username formats
    if (author.social.twitter) {
      const handle = author.social.twitter.replace('@', '');
      author.social.twitter = `https://x.com/${handle}`;
    }
    
    return {
      site: config.site,
      author,
      analytics: config.services.analytics,
      currentYear: new Date().getFullYear(),
      enableSearch: config.content.enableSearch,
      enableServiceWorker: config.performance.enableServiceWorker
    };
  }

  /**
   * Setup Handlebars helpers
   */
  setupHandlebarsHelpers() {
    // Date formatting helper
    this.handlebars.registerHelper('formatDate', (date, formatStr = 'MMMM d, yyyy') => {
      if (!date) return '';
      
      try {
        const parsedDate = typeof date === 'string' ? parseISO(date) : date;
        
        // Validate the format string - ensure it's a string before checking
        let safeFormatStr = typeof formatStr === 'string' ? formatStr : 'MMMM d, yyyy';
        
        // Common problematic formats and their fixes
        if (safeFormatStr === 'do MMMM, yyyy') {
          safeFormatStr = "'do' MMMM, yyyy";
        } else if (safeFormatStr.includes && safeFormatStr.includes('do') && !safeFormatStr.includes("'do'")) {
          // Escape the 'do' if it's not already escaped
          safeFormatStr = safeFormatStr.replace(/\bdo\b/g, "'do'");
        }
        
        return format(parsedDate, safeFormatStr);
      } catch (error) {
        logger.warn(`Date formatting error: ${error.message}, using fallback format`);
        // Fallback to a safe format
        try {
          const parsedDate = typeof date === 'string' ? parseISO(date) : date;
          return format(parsedDate, 'MMMM d, yyyy');
        } catch (fallbackError) {
          logger.error(`Date parsing failed entirely for: ${date}`);
          return date.toString();
        }
      }
    });
    
    // Truncate text helper
    this.handlebars.registerHelper('truncate', (text, length = 100) => {
      if (!text || text.length <= length) return text;
      return text.substring(0, length).trim() + '...';
    });
    
    // Slugify helper
    this.handlebars.registerHelper('slugify', (text) => {
      return this.slugify(text);
    });
    
    // Substring helper
    this.handlebars.registerHelper('substring', (text, start, end) => {
      if (!text) return '';
      return text.substring(start, end);
    });
    
    // Equality helper
    this.handlebars.registerHelper('eq', (a, b) => {
      return a === b;
    });
    
    // Greater than helper
    this.handlebars.registerHelper('gt', (a, b) => {
      return a > b;
    });
    
    // Or helper
    this.handlebars.registerHelper('or', (...args) => {
      args.pop(); // Remove options object
      return args.some(Boolean);
    });
    
    // Twitter handle helper - extracts handle from Twitter URL
    this.handlebars.registerHelper('twitterHandle', (twitterUrl) => {
      if (!twitterUrl) return '';
      // Extract handle from URL like https://x.com/SanketBhat11 or @SanketBhat11
      const match = twitterUrl.match(/(?:x\.com\/|twitter\.com\/|@)([a-zA-Z0-9_]+)/);
      return match ? match[1] : twitterUrl.replace('@', '');
    });
  }

  /**
   * Utility function to create URL-friendly slugs
   */
  slugify(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--force':
        options.force = true;
        break;
      case '--debug':
        process.env.LOG_LEVEL = 'debug';
        break;
      case '--help':
        console.log(`
Usage: npm run build [options]

Options:
  --force     Force rebuild all pages
  --debug     Enable debug logging
  --help      Show this help message

Examples:
  npm run build
  npm run build -- --force
        `);
        process.exit(0);
    }
  }

  try {
    const builder = new SiteBuilder(options);
    await builder.build();
    process.exit(0);
  } catch (error) {
    logger.error('Build failed', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SiteBuilder; 
module.exports = SiteBuilder; 