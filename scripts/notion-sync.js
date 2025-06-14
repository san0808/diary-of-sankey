#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
// const { format } = require('date-fns'); // Currently unused
const logger = require('./utils/logger');
const NotionClient = require('./utils/notion-client');
const ContentProcessor = require('./utils/content-processor');
const config = require('../config/site.config');

/**
 * Performance utilities for monitoring and optimization
 */
class PerformanceTracker {
  constructor() {
    this.timers = new Map();
    this.metrics = {};
  }

  startTimer(operation) {
    this.timers.set(operation, Date.now());
    logger.debug(`⏱️  Started: ${operation}`);
  }

  endTimer(operation) {
    const startTime = this.timers.get(operation);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.metrics[operation] = duration;
      logger.info(`✅ Completed: ${operation} (${duration}ms)`);
      this.timers.delete(operation);
      return duration;
    }
    return 0;
  }

  trackMemory() {
    const usage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
    return this.metrics.memory;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

/**
 * Utility function to chunk array into smaller batches
 */
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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
    this.concurrency = options.concurrency || 5; // Process 5 posts concurrently
    this.performanceTracker = new PerformanceTracker();
    
    // Ensure content directory exists
    fs.ensureDirSync(this.contentDir);
  }

  /**
   * Main sync method - orchestrates the entire sync process
   */
  async sync() {
    const syncTimer = logger.timer('Notion sync');
    this.performanceTracker.startTimer('total_sync');
    
    try {
      logger.section('Starting Optimized Notion Sync');
      
      // Track initial memory usage
      const initialMemory = this.performanceTracker.trackMemory();
      logger.info(`Initial memory usage: ${initialMemory.heapUsed}MB`);
      
      // Test connection first
      this.performanceTracker.startTimer('connection_test');
      const connectionOk = await this.notionClient.testConnection();
      this.performanceTracker.endTimer('connection_test');
      
      if (!connectionOk) {
        throw new Error('Failed to connect to Notion API');
      }

      // Get all content from Notion in parallel
      this.performanceTracker.startTimer('fetch_posts');
      const [publishedPosts, scheduledPosts, draftPosts] = await Promise.all([
        this.notionClient.getPublishedPosts(),
        this.notionClient.getScheduledPosts(),
        this.notionClient.getDraftPosts()
      ]);
      this.performanceTracker.endTimer('fetch_posts');

      logger.info(`Found ${publishedPosts.length} published posts`);
      logger.info(`Found ${scheduledPosts.length} scheduled posts`);
      logger.info(`Found ${draftPosts.length} draft posts`);

      // Process all posts with parallel batching
      const allPosts = [...publishedPosts, ...scheduledPosts, ...draftPosts];
      this.performanceTracker.startTimer('process_posts');
      const processedPosts = await this.processPostsInParallel(allPosts);
      this.performanceTracker.endTimer('process_posts');

      // Generate index files
      this.performanceTracker.startTimer('generate_indexes');
      await this.generateIndexes(processedPosts);
      this.performanceTracker.endTimer('generate_indexes');

      // Clean up old content
      this.performanceTracker.startTimer('cleanup');
      await this.cleanupOldContent(processedPosts);
      
      // Clean up unused cached images (if image caching is enabled)
      await this.contentProcessor.cleanupUnusedImages();
      this.performanceTracker.endTimer('cleanup');

      // Track final memory usage
      const finalMemory = this.performanceTracker.trackMemory();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Log performance metrics
      const totalTime = this.performanceTracker.endTimer('total_sync');
      const metrics = this.performanceTracker.getMetrics();
      
      logger.success(`🚀 Sync completed successfully! Processed ${processedPosts.length} posts`);
      logger.info(`📊 Performance Summary:`);
      logger.info(`   Total time: ${totalTime}ms`);
      logger.info(`   Posts processed: ${processedPosts.length}`);
      logger.info(`   Average per post: ${Math.round(totalTime / processedPosts.length)}ms`);
      logger.info(`   Memory usage: ${finalMemory.heapUsed}MB (${memoryIncrease >= 0 ? '+' : ''}${memoryIncrease}MB)`);
      logger.info(`   Fetch time: ${metrics.fetch_posts}ms`);
      logger.info(`   Processing time: ${metrics.process_posts}ms`);
      logger.info(`   Index generation: ${metrics.generate_indexes}ms`);
      
      syncTimer();
      
      return {
        totalPosts: processedPosts.length,
        published: publishedPosts.length,
        scheduled: scheduledPosts.length,
        drafts: draftPosts.length,
        performance: metrics
      };

    } catch (error) {
      logger.error('Sync failed', error);
      throw error;
    }
  }

  /**
   * Process posts in parallel batches for optimal performance
   * @param {Array} allPosts - All posts to process
   * @returns {Promise<Array>} Processed posts
   */
  async processPostsInParallel(allPosts) {
    if (allPosts.length === 0) {
      return [];
    }

    logger.info(`🔄 Processing ${allPosts.length} posts with concurrency: ${this.concurrency}`);
    
    // Split posts into batches for parallel processing
    const batches = chunk(allPosts, this.concurrency);
    const processedPosts = [];
    let processedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchTimer = `batch_${i + 1}`;
      this.performanceTracker.startTimer(batchTimer);
      
      logger.info(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} posts)`);

      try {
        // Process batch in parallel with error handling
        const batchPromises = batch.map(async (post, index) => {
          try {
            const result = await this.processPost(post);
            processedCount++;
            
            // Log progress
            if (processedCount % 5 === 0 || processedCount === allPosts.length) {
              logger.info(`📈 Progress: ${processedCount}/${allPosts.length} posts processed`);
            }
            
            return { status: 'fulfilled', value: result };
          } catch (error) {
            logger.error(`Failed to process post in batch ${i + 1}, position ${index}:`, error);
            return { status: 'rejected', reason: error };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Collect successful results
        const successfulResults = batchResults
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);
        
        processedPosts.push(...successfulResults);
        
        // Log batch completion
        const batchTime = this.performanceTracker.endTimer(batchTimer);
        const successCount = successfulResults.length;
        const failureCount = batch.length - successCount;
        
        logger.info(`✅ Batch ${i + 1} completed: ${successCount} success, ${failureCount} failed (${batchTime}ms)`);
        
        // Brief pause between batches to prevent overwhelming the API
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        logger.error(`Batch ${i + 1} failed completely:`, error);
        this.performanceTracker.endTimer(batchTimer);
      }
    }

    logger.success(`🎉 Parallel processing completed: ${processedPosts.length}/${allPosts.length} posts processed successfully`);
    return processedPosts;
  }

  /**
   * Process a single post from Notion with smart caching
   * @param {Object} notionPage - Notion page object
   * @returns {Promise<Object|null>} Processed post data
   */
  async processPost(notionPage) {
    const postTimer = logger.timer(`Process post: ${notionPage.id}`);
    
    try {
      // Extract metadata from Notion page (lightweight operation)
      const metadata = await this.notionClient.extractMetadata(notionPage);
      
      logger.debug(`🔍 Checking post: ${metadata.title}`);

      // Smart caching: Check if we need to update this post
      const existingPost = await this.getExistingPost(metadata.slug);
      const shouldUpdate = this.shouldUpdatePost(existingPost, metadata);
      
      if (!shouldUpdate && !this.force) {
        logger.debug(`⚡ Cache hit: Skipping unchanged post: ${metadata.title}`);
        postTimer();
        return existingPost;
      }

      // Only fetch content blocks if we need to update
      logger.debug(`🔄 Processing updated post: ${metadata.title}`);
      const blocks = await this.notionClient.getPageBlocks(notionPage.id);
      
      // Process content
      const processedContent = await this.contentProcessor.processPage(notionPage, blocks);
      
      // Combine metadata and content
      const postData = {
        ...metadata,
        ...processedContent,
        lastSynced: new Date().toISOString(),
        syncVersion: '2.0' // Track sync version for future optimizations
      };

      // Save the post
      await this.savePost(postData);
      
      logger.success(`✅ Processed: ${metadata.title}`);
      postTimer();
      
      return postData;

    } catch (error) {
      logger.error(`❌ Failed to process post ${notionPage.id}`, error);
      postTimer();
      return null;
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