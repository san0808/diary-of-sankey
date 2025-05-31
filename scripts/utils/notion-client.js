const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const logger = require('./logger');
const config = require('../../config/site.config');

/**
 * Enhanced Notion client with rate limiting, retries, and error handling
 */
class NotionClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.notion.apiKey;
    this.databaseId = options.databaseId || config.notion.databaseId;
    
    if (!this.apiKey) {
      throw new Error('Notion API key is required');
    }
    
    if (!this.databaseId) {
      throw new Error('Notion database ID is required');
    }

    // Initialize Notion client
    this.notion = new Client({
      auth: this.apiKey,
      notionVersion: config.notion.version
    });

    // Initialize Notion to Markdown converter
    this.n2m = new NotionToMarkdown({ 
      notionClient: this.notion,
      config: {
        parseChildPages: false,
        convertCallouts: true
      }
    });

    // Rate limiting configuration
    this.rateLimiter = {
      requests: 0,
      resetTime: Date.now() + 60000, // Reset every minute
      maxRequests: 3 // Notion allows 3 requests per second
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      backoffFactor: 2
    };
  }

  /**
   * Rate limiting check and wait
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if a minute has passed
    if (now > this.rateLimiter.resetTime) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetTime = now + 60000;
    }

    // If we've hit the limit, wait
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      const waitTime = this.rateLimiter.resetTime - now;
      if (waitTime > 0) {
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.rateLimiter.requests = 0;
        this.rateLimiter.resetTime = Date.now() + 60000;
      }
    }

    this.rateLimiter.requests++;
  }

  /**
   * Retry wrapper for API calls
   * @param {Function} operation - Function to retry
   * @param {string} operationName - Name for logging
   * @returns {Promise} Operation result
   */
  async withRetry(operation, operationName) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`${operationName} succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.code === 'object_not_found' || 
            error.code === 'unauthorized' ||
            error.code === 'invalid_request') {
          throw error;
        }

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt),
            this.retryConfig.maxDelay
          );
          
          logger.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms`, {
            error: error.message,
            code: error.code
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`${operationName} failed after ${this.retryConfig.maxRetries} retries`, lastError);
    throw lastError;
  }

  /**
   * Fetch all pages from the database with filtering
   * @param {Object} filter - Notion filter object
   * @param {Object} sorts - Notion sorts array
   * @returns {Promise<Array>} Array of page objects
   */
  async queryDatabase(filter = {}, sorts = []) {
    return this.withRetry(async () => {
      const pages = [];
      let cursor;
      
      do {
        const response = await this.notion.databases.query({
          database_id: this.databaseId,
          filter,
          sorts,
          start_cursor: cursor,
          page_size: 100 // Maximum allowed by Notion
        });

        pages.push(...response.results);
        cursor = response.next_cursor;
        
        logger.debug(`Fetched ${response.results.length} pages, total: ${pages.length}`);
      } while (cursor);

      return pages;
    }, 'Database query');
  }

  /**
   * Update a page's publish date
   * @param {string} pageId - Page ID
   * @param {string} date - ISO date string
   * @returns {Promise<Object>} Updated page
   */
  async updatePublishDate(pageId, date) {
    return this.withRetry(async () => {
      return this.notion.pages.update({
        page_id: pageId,
        properties: {
          'Publish Date': {
            date: {
              start: date
            }
          }
        }
      });
    }, `Update publish date for page ${pageId}`);
  }

  /**
   * Get all published posts, auto-setting publish date if missing
   * @returns {Promise<Array>} Published posts
   */
  async getPublishedPosts() {
    // First, get all posts with Published status (regardless of publish date)
    const allPublishedFilter = {
      property: 'Status',
      select: {
        equals: 'Published'
      }
    };

    const allPublishedPosts = await this.queryDatabase(allPublishedFilter);
    
    // Check for posts without publish dates and auto-set them
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const postsToUpdate = [];
    
    for (const post of allPublishedPosts) {
      const publishDate = post.properties['Publish Date']?.date?.start;
      
      if (!publishDate) {
        logger.info(`Auto-setting publish date for: ${this.getPropertyValue(post.properties.Title)}`);
        try {
          await this.updatePublishDate(post.id, today);
          // Update the post object in memory
          post.properties['Publish Date'] = {
            id: post.properties['Publish Date']?.id,
            type: 'date',
            date: {
              start: today,
              end: null,
              time_zone: null
            }
          };
          postsToUpdate.push(post);
        } catch (error) {
          logger.warn(`Failed to auto-set publish date for post ${post.id}`, error);
        }
      }
    }

    if (postsToUpdate.length > 0) {
      logger.success(`Auto-set publish dates for ${postsToUpdate.length} posts`);
    }

    // Now filter for posts with valid publish dates (including the ones we just set)
    const validPublishedPosts = allPublishedPosts.filter(post => {
      const publishDate = post.properties['Publish Date']?.date?.start;
      if (!publishDate) return false;
      
      const publishDateTime = new Date(publishDate);
      const now = new Date();
      return publishDateTime <= now;
    });

    // Sort by publish date (newest first)
    validPublishedPosts.sort((a, b) => {
      const dateA = new Date(a.properties['Publish Date'].date.start);
      const dateB = new Date(b.properties['Publish Date'].date.start);
      return dateB - dateA;
    });

    return validPublishedPosts;
  }

  /**
   * Get scheduled posts (to be published in the future)
   * @returns {Promise<Array>} Scheduled posts
   */
  async getScheduledPosts() {
    const filter = {
      and: [
        {
          property: 'Status',
          select: {
            equals: 'Scheduled'
          }
        },
        {
          property: 'Publish Date',
          date: {
            after: new Date().toISOString()
          }
        }
      ]
    };

    const sorts = [
      {
        property: 'Publish Date',
        direction: 'ascending'
      }
    ];

    return this.queryDatabase(filter, sorts);
  }

  /**
   * Get draft posts
   * @returns {Promise<Array>} Draft posts
   */
  async getDraftPosts() {
    const filter = {
      property: 'Status',
      select: {
        equals: 'Draft'
      }
    };

    return this.queryDatabase(filter);
  }

  /**
   * Get posts by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Posts in category
   */
  async getPostsByCategory(category) {
    const filter = {
      and: [
        {
          property: 'Category',
          select: {
            equals: category
          }
        },
        {
          property: 'Status',
          select: {
            equals: 'Published'
          }
        }
      ]
    };

    return this.queryDatabase(filter);
  }

  /**
   * Get a specific page by ID
   * @param {string} pageId - Page ID
   * @returns {Promise<Object>} Page object
   */
  async getPage(pageId) {
    return this.withRetry(async () => {
      return this.notion.pages.retrieve({ page_id: pageId });
    }, `Get page ${pageId}`);
  }

  /**
   * Get page content blocks
   * @param {string} pageId - Page ID
   * @returns {Promise<Array>} Array of blocks
   */
  async getPageBlocks(pageId) {
    return this.withRetry(async () => {
      const blocks = [];
      let cursor;

      do {
        const response = await this.notion.blocks.children.list({
          block_id: pageId,
          start_cursor: cursor,
          page_size: 100
        });

        blocks.push(...response.results);
        cursor = response.next_cursor;
      } while (cursor);

      return blocks;
    }, `Get blocks for page ${pageId}`);
  }

  /**
   * Convert Notion page to markdown
   * @param {string} pageId - Page ID
   * @returns {Promise<string>} Markdown content
   */
  async pageToMarkdown(pageId) {
    return this.withRetry(async () => {
      const mdblocks = await this.n2m.pageToMarkdown(pageId);
      return this.n2m.toMarkdownString(mdblocks);
    }, `Convert page ${pageId} to markdown`);
  }

  /**
   * Extract metadata from a Notion page
   * @param {Object} page - Notion page object
   * @returns {Object} Extracted metadata
   */
  extractMetadata(page) {
    const properties = page.properties;
    
    try {
      const metadata = {
        id: page.id,
        title: this.getPropertyValue(properties.Title || properties.title || properties.Name),
        status: this.getPropertyValue(properties.Status),
        category: this.getPropertyValue(properties.Category),
        publishDate: this.getPropertyValue(properties['Publish Date']),
        tags: this.getPropertyValue(properties.Tags) || [],
        slug: this.getPropertyValue(properties.Slug),
        excerpt: this.getPropertyValue(properties.Excerpt),
        featuredImage: this.getPropertyValue(properties['Featured Image']),
        featured: this.getPropertyValue(properties.Featured) || false,
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time
      };

      // Generate slug from title if not provided
      if (!metadata.slug && metadata.title) {
        metadata.slug = this.generateSlug(metadata.title);
      }

      // Validate required fields
      if (!metadata.title) {
        throw new Error(`Page ${page.id} is missing a title`);
      }

      if (!metadata.status) {
        throw new Error(`Page ${page.id} is missing a status`);
      }

      return metadata;
    } catch (error) {
      logger.error(`Failed to extract metadata from page ${page.id}`, error);
      throw error;
    }
  }

  /**
   * Get property value from Notion property object
   * @param {Object} property - Notion property
   * @returns {any} Property value
   */
  getPropertyValue(property) {
    if (!property) return null;

    switch (property.type) {
      case 'title':
        return property.title?.[0]?.plain_text || '';
      case 'rich_text':
        return property.rich_text?.map(t => t.plain_text).join('') || '';
      case 'select':
        return property.select?.name || null;
      case 'multi_select':
        return property.multi_select?.map(s => s.name) || [];
      case 'date':
        return property.date?.start || null;
      case 'checkbox':
        return property.checkbox || false;
      case 'files':
        return property.files?.[0]?.file?.url || property.files?.[0]?.external?.url || null;
      case 'number':
        return property.number || 0;
      case 'url':
        return property.url || null;
      case 'email':
        return property.email || null;
      case 'phone_number':
        return property.phone_number || null;
      default:
        logger.warn(`Unknown property type: ${property.type}`);
        return null;
    }
  }

  /**
   * Generate a URL-friendly slug from title
   * @param {string} title - Post title
   * @returns {string} URL slug
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove multiple consecutive hyphens
      .trim('-'); // Remove leading/trailing hyphens
  }

  /**
   * Test the connection to Notion
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      await this.withRetry(async () => {
        await this.notion.databases.retrieve({ database_id: this.databaseId });
      }, 'Test connection');
      
      logger.success('Notion connection test successful');
      return true;
    } catch (error) {
      logger.error('Notion connection test failed', error);
      return false;
    }
  }

  /**
   * Get database schema for validation
   * @returns {Promise<Object>} Database schema
   */
  async getDatabaseSchema() {
    return this.withRetry(async () => {
      const database = await this.notion.databases.retrieve({ 
        database_id: this.databaseId 
      });
      return database.properties;
    }, 'Get database schema');
  }
}

module.exports = NotionClient; 