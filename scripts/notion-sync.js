#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
// const { format } = require('date-fns'); // Currently unused
const logger = require('./utils/logger');
const NotionClient = require('./utils/notion-client');
const ContentProcessor = require('./utils/content-processor');
const config = require('../config/site.config');

/**
 * Main class for syncing content from Notion to local files
 */
class NotionSync {
  constructor(options = {}) {
    this.notionClient = new NotionClient(options);
    this.contentProcessor = new ContentProcessor(options);
    this.contentDir = path.join(process.cwd(), config.build.contentDir);
    this.force = options.force || false;
    this.dryRun = options.dryRun || false;
    
    // Ensure content directory exists
    fs.ensureDirSync(this.contentDir);
  }

  /**
   * Main sync method - orchestrates the entire sync process
   */
  async sync() {
    const syncTimer = logger.timer('Notion sync');
    
    try {
      logger.section('Starting Notion Sync');
      
      // Test connection first
      const connectionOk = await this.notionClient.testConnection();
      if (!connectionOk) {
        throw new Error('Failed to connect to Notion API');
      }

      // Get all content from Notion
      const [publishedPosts, scheduledPosts, draftPosts] = await Promise.all([
        this.notionClient.getPublishedPosts(),
        this.notionClient.getScheduledPosts(),
        this.notionClient.getDraftPosts()
      ]);

      logger.info(`Found ${publishedPosts.length} published posts`);
      logger.info(`Found ${scheduledPosts.length} scheduled posts`);
      logger.info(`Found ${draftPosts.length} draft posts`);

      // Process all posts
      const allPosts = [...publishedPosts, ...scheduledPosts, ...draftPosts];
      const processedPosts = [];

      for (const post of allPosts) {
        try {
          const processedPost = await this.processPost(post);
          if (processedPost) {
            processedPosts.push(processedPost);
          }
        } catch (error) {
          logger.error(`Failed to process post: ${post.id}`, error);
          // Continue with other posts
        }
      }

      // Generate index files
      await this.generateIndexes(processedPosts);

      // Clean up old content
      await this.cleanupOldContent(processedPosts);

      logger.success(`Sync completed successfully! Processed ${processedPosts.length} posts`);
      syncTimer();
      
      return {
        totalPosts: processedPosts.length,
        published: publishedPosts.length,
        scheduled: scheduledPosts.length,
        drafts: draftPosts.length
      };

    } catch (error) {
      logger.error('Sync failed', error);
      throw error;
    }
  }

  /**
   * Process a single post from Notion
   * @param {Object} notionPage - Notion page object
   * @returns {Promise<Object|null>} Processed post data
   */
  async processPost(notionPage) {
    const postTimer = logger.timer(`Process post: ${notionPage.id}`);
    
    try {
      // Extract metadata from Notion page
      const metadata = this.notionClient.extractMetadata(notionPage);
      
      logger.debug(`Processing post: ${metadata.title}`);

      // Check if we need to update this post
      const existingPost = await this.getExistingPost(metadata.slug);
      const shouldUpdate = this.shouldUpdatePost(existingPost, metadata);
      
      if (!shouldUpdate && !this.force) {
        logger.debug(`Skipping unchanged post: ${metadata.title}`);
        return existingPost;
      }

      // Get page content blocks
      const blocks = await this.notionClient.getPageBlocks(notionPage.id);
      
      // Process content
      const processedContent = await this.contentProcessor.processPage(notionPage, blocks);
      
      // Combine metadata and content
      const postData = {
        ...metadata,
        ...processedContent,
        lastSynced: new Date().toISOString()
      };

      // Save the post
      await this.savePost(postData);
      
      logger.success(`Processed: ${metadata.title}`);
      postTimer();
      
      return postData;

    } catch (error) {
      logger.error(`Failed to process post ${notionPage.id}`, error);
      throw error;
    }
  }

  /**
   * Check if a post should be updated
   * @param {Object|null} existingPost - Existing post data
   * @param {Object} newMetadata - New metadata from Notion
   * @returns {boolean} Whether the post should be updated
   */
  shouldUpdatePost(existingPost, newMetadata) {
    if (!existingPost) return true;
    
    // Always update if forced
    if (this.force) return true;
    
    // Check if last edited time is newer
    const existingLastEdited = new Date(existingPost.lastEditedTime);
    const newLastEdited = new Date(newMetadata.lastEditedTime);
    
    return newLastEdited > existingLastEdited;
  }

  /**
   * Get existing post data if it exists
   * @param {string} slug - Post slug
   * @returns {Promise<Object|null>} Existing post data or null
   */
  async getExistingPost(slug) {
    const postPath = path.join(this.contentDir, 'posts', `${slug}.json`);
    
    try {
      if (await fs.pathExists(postPath)) {
        return await fs.readJson(postPath);
      }
    } catch (error) {
      logger.debug(`Could not read existing post: ${slug}`, error);
    }
    
    return null;
  }

  /**
   * Save post data to file system
   * @param {Object} postData - Complete post data
   */
  async savePost(postData) {
    if (this.dryRun) {
      logger.info(`[DRY RUN] Would save post: ${postData.slug}`);
      return;
    }

    const postsDir = path.join(this.contentDir, 'posts');
    await fs.ensureDir(postsDir);
    
    const postPath = path.join(postsDir, `${postData.slug}.json`);
    
    // Save main post data
    await fs.writeJson(postPath, postData, { spaces: 2 });
    
    // Save HTML content separately for easier reading
    const htmlPath = path.join(postsDir, `${postData.slug}.html`);
    await fs.writeFile(htmlPath, postData.content);
    
    logger.debug(`Saved post: ${postPath}`);
  }

  /**
   * Generate index files for navigation and listing
   * @param {Array} posts - Array of processed posts
   */
  async generateIndexes(posts) {
    logger.info('Generating content indexes...');
    
    if (this.dryRun) {
      logger.info('[DRY RUN] Would generate indexes');
      return;
    }

    // Sort posts by publish date (newest first)
    const sortedPosts = posts
      .filter(post => post.status === 'Published')
      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

    // Generate main posts index
    const postsIndex = {
      posts: sortedPosts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        publishDate: post.publishDate,
        category: post.category,
        tags: post.tags,
        readingTime: post.readingTime,
        wordCount: post.wordCount,
        featured: post.featured
      })),
      totalPosts: sortedPosts.length,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeJson(
      path.join(this.contentDir, 'posts-index.json'),
      postsIndex,
      { spaces: 2 }
    );

    // Generate category indexes
    await this.generateCategoryIndexes(sortedPosts);

    // Generate tags index
    await this.generateTagsIndex(sortedPosts);

    // Generate scheduled posts preview index
    const scheduledPosts = posts.filter(post => post.status === 'Scheduled');
    if (scheduledPosts.length > 0) {
      await this.generateScheduledIndex(scheduledPosts);
    }

    logger.success('Generated content indexes');
  }

  /**
   * Generate category-specific indexes
   * @param {Array} posts - Published posts
   */
  async generateCategoryIndexes(posts) {
    const categoriesDir = path.join(this.contentDir, 'categories');
    await fs.ensureDir(categoriesDir);

    const categories = {};
    
    // Group posts by category
    posts.forEach(post => {
      if (!post.category) return;
      
      if (!categories[post.category]) {
        categories[post.category] = [];
      }
      categories[post.category].push(post);
    });

    // Save each category index
    for (const [categoryName, categoryPosts] of Object.entries(categories)) {
      const categorySlug = categoryName.toLowerCase().replace(/\s+/g, '-');
      const categoryIndex = {
        category: categoryName,
        slug: categorySlug,
        posts: categoryPosts.map(post => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          publishDate: post.publishDate,
          tags: post.tags,
          readingTime: post.readingTime
        })),
        totalPosts: categoryPosts.length,
        lastUpdated: new Date().toISOString()
      };

      await fs.writeJson(
        path.join(categoriesDir, `${categorySlug}.json`),
        categoryIndex,
        { spaces: 2 }
      );
    }

    // Save categories overview
    const categoriesOverview = {
      categories: Object.keys(categories).map(name => ({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        count: categories[name].length
      })),
      lastUpdated: new Date().toISOString()
    };

    await fs.writeJson(
      path.join(categoriesDir, 'index.json'),
      categoriesOverview,
      { spaces: 2 }
    );
  }

  /**
   * Generate tags index
   * @param {Array} posts - Published posts
   */
  async generateTagsIndex(posts) {
    const tags = {};
    
    // Collect all tags
    posts.forEach(post => {
      if (!post.tags || !Array.isArray(post.tags)) return;
      
      post.tags.forEach(tag => {
        if (!tags[tag]) {
          tags[tag] = [];
        }
        tags[tag].push({
          id: post.id,
          title: post.title,
          slug: post.slug,
          publishDate: post.publishDate,
          category: post.category
        });
      });
    });

    // Sort tags by frequency
    const sortedTags = Object.keys(tags)
      .map(tag => ({
        name: tag,
        slug: tag.toLowerCase().replace(/\s+/g, '-'),
        count: tags[tag].length,
        posts: tags[tag]
      }))
      .sort((a, b) => b.count - a.count);

    const tagsIndex = {
      tags: sortedTags,
      totalTags: sortedTags.length,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeJson(
      path.join(this.contentDir, 'tags-index.json'),
      tagsIndex,
      { spaces: 2 }
    );
  }

  /**
   * Generate scheduled posts index for preview
   * @param {Array} scheduledPosts - Scheduled posts
   */
  async generateScheduledIndex(scheduledPosts) {
    const scheduledIndex = {
      posts: scheduledPosts
        .sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate))
        .map(post => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          publishDate: post.publishDate,
          category: post.category,
          tags: post.tags
        })),
      totalScheduled: scheduledPosts.length,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeJson(
      path.join(this.contentDir, 'scheduled-index.json'),
      scheduledIndex,
      { spaces: 2 }
    );
  }

  /**
   * Clean up old content that no longer exists in Notion
   * @param {Array} currentPosts - Current posts from Notion
   */
  async cleanupOldContent(currentPosts) {
    if (this.dryRun) {
      logger.info('[DRY RUN] Would clean up old content');
      return;
    }

    const postsDir = path.join(this.contentDir, 'posts');
    
    try {
      const existingFiles = await fs.readdir(postsDir);
      const currentSlugs = new Set(currentPosts.map(post => post.slug));
      
      let deletedCount = 0;
      
      for (const file of existingFiles) {
        if (!file.endsWith('.json')) continue;
        
        const slug = path.basename(file, '.json');
        
        if (!currentSlugs.has(slug)) {
          // Delete both JSON and HTML files
          await fs.remove(path.join(postsDir, file));
          await fs.remove(path.join(postsDir, `${slug}.html`));
          
          logger.debug(`Cleaned up old post: ${slug}`);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old posts`);
      }
      
    } catch (error) {
      logger.warn('Failed to clean up old content', error);
    }
  }

  /**
   * Sync a specific post by ID
   * @param {string} pageId - Notion page ID
   * @returns {Promise<Object>} Processed post data
   */
  async syncPost(pageId) {
    logger.info(`Syncing specific post: ${pageId}`);
    
    try {
      const page = await this.notionClient.getPage(pageId);
      const processedPost = await this.processPost(page);
      
      logger.success(`Successfully synced post: ${processedPost.title}`);
      return processedPost;
      
    } catch (error) {
      logger.error(`Failed to sync post: ${pageId}`, error);
      throw error;
    }
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
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--post':
        options.postId = args[++i];
        break;
      case '--debug':
        process.env.LOG_LEVEL = 'debug';
        break;
      case '--help':
        console.log(`
Usage: npm run sync [options]

Options:
  --force     Force update all posts regardless of edit time
  --dry-run   Show what would be done without making changes
  --post ID   Sync only a specific post by ID
  --debug     Enable debug logging
  --help      Show this help message

Examples:
  npm run sync
  npm run sync -- --force
  npm run sync -- --post abc123
  npm run sync -- --dry-run --debug
        `);
        process.exit(0);
    }
  }

  try {
    const sync = new NotionSync(options);
    
    if (options.postId) {
      await sync.syncPost(options.postId);
    } else {
      await sync.sync();
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Sync failed', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = NotionSync; 