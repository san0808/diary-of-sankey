const { parse } = require('node-html-parser');
const marked = require('marked');
const path = require('path');
const https = require('https');
const http = require('http');
const logger = require('./logger');

/**
 * Content processor for converting Notion content to styled HTML
 * Preserves the original design while adding enhanced functionality
 */
class ContentProcessor {
  constructor(options = {}) {
    this.preserveDesign = options.preserveDesign !== false;
    this.enableSyntaxHighlighting = options.enableSyntaxHighlighting !== false;
    this.enableMathJax = options.enableMathJax !== false;
    
    // Configure marked for markdown processing
    this.configureMarked();
    
    // Block type processors
    this.blockProcessors = {
      paragraph: this.processParagraph.bind(this),
      heading_1: this.processHeading1.bind(this),
      heading_2: this.processHeading2.bind(this),
      heading_3: this.processHeading3.bind(this),
      bulleted_list_item: this.processBulletedListItem.bind(this),
      numbered_list_item: this.processNumberedListItem.bind(this),
      code: this.processCodeBlock.bind(this),
      quote: this.processQuote.bind(this),
      callout: this.processCallout.bind(this),
      image: this.processImage.bind(this),
      equation: this.processEquation.bind(this),
      table: this.processTable.bind(this),
      divider: this.processDivider.bind(this),
      bookmark: this.processBookmark.bind(this),
      embed: this.processEmbed.bind(this)
    };
  }

  /**
   * Configure marked for consistent markdown processing
   */
  configureMarked() {
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true,
      headerPrefix: 'heading-'
    });

    // Custom renderer for preserving design
    const renderer = new marked.Renderer();
    
    // Override paragraph rendering
    renderer.paragraph = (text) => {
      return `<p class="mt-4 font-serif text-lg">${text}</p>\n`;
    };

    // Override heading rendering
    renderer.heading = (text, level) => {
      const classes = this.getHeadingClasses(level);
      const id = text.toLowerCase().replace(/[^\w]+/g, '-');
      return `<h${level} id="${id}" class="${classes}">${text}</h${level}>\n`;
    };

    // Override list rendering
    renderer.list = (body, ordered) => {
      const tag = ordered ? 'ol' : 'ul';
      const classes = ordered ? 'list-decimal ml-8' : 'list-disc ml-4 font-serif';
      return `<${tag} class="${classes}">\n${body}</${tag}>\n`;
    };

    // Override code rendering
    renderer.code = (code, language) => {
      return this.renderCodeBlock(code, language);
    };

    marked.use({ renderer });
  }

  /**
   * Process a complete Notion page to HTML
   * @param {Object} page - Notion page object
   * @param {Array} blocks - Notion blocks array
   * @returns {Promise<Object>} Processed content with metadata
   */
  async processPage(page, blocks) {
    const timer = logger.timer(`Process page: ${page.properties?.Title?.title?.[0]?.plain_text || 'Untitled'}`);
    
    try {
      // Process content blocks
      const contentHtml = await this.processBlocks(blocks);
      
      // Calculate reading time
      const readingTime = this.calculateReadingTime(contentHtml);
      
      // Generate table of contents
      const tableOfContents = this.generateTableOfContents(contentHtml);
      
      // Extract excerpt if not provided
      const excerpt = this.extractExcerpt(contentHtml);

      const result = {
        content: contentHtml,
        readingTime,
        tableOfContents,
        excerpt,
        wordCount: this.countWords(contentHtml)
      };

      timer();
      return result;
    } catch (error) {
      logger.error('Failed to process page content', error);
      throw error;
    }
  }

  /**
   * Process an array of Notion blocks
   * @param {Array} blocks - Notion blocks
   * @returns {Promise<string>} HTML content
   */
  async processBlocks(blocks) {
    const htmlParts = [];
    let currentList = null;
    let currentListType = null;

    for (const block of blocks) {
      try {
        const blockType = block.type;
        
        // Handle list grouping
        if (blockType === 'bulleted_list_item' || blockType === 'numbered_list_item') {
          const listType = blockType === 'bulleted_list_item' ? 'ul' : 'ol';
          
          if (currentListType !== listType) {
            // Close previous list if different type
            if (currentList) {
              htmlParts.push(this.closeList(currentListType));
            }
            // Start new list
            currentList = [];
            currentListType = listType;
            htmlParts.push(this.openList(listType));
          }
          
          const listItemHtml = await this.processBlock(block);
          htmlParts.push(listItemHtml);
        } else {
          // Close any open list
          if (currentList) {
            htmlParts.push(this.closeList(currentListType));
            currentList = null;
            currentListType = null;
          }
          
          const blockHtml = await this.processBlock(block);
          if (blockHtml) {
            htmlParts.push(blockHtml);
          }
        }
      } catch (error) {
        logger.warn(`Failed to process block ${block.id}`, { error: error.message });
        // Continue processing other blocks
      }
    }

    // Close any remaining open list
    if (currentList) {
      htmlParts.push(this.closeList(currentListType));
    }

    return htmlParts.join('\n');
  }

  /**
   * Process a single Notion block
   * @param {Object} block - Notion block
   * @returns {Promise<string>} HTML for the block
   */
  async processBlock(block) {
    const processor = this.blockProcessors[block.type];
    
    if (!processor) {
      logger.debug(`No processor for block type: ${block.type}`);
      return '';
    }

    return processor(block);
  }

  /**
   * Process paragraph block
   */
  processParagraph(block) {
    // Add null check to prevent crashes
    if (!block.paragraph || !block.paragraph.rich_text) {
      return '';
    }
    
    const text = this.extractRichText(block.paragraph.rich_text);
    if (!text.trim()) return '';
    
    return `<p class="mt-4 font-serif text-lg">${text}</p>`;
  }

  /**
   * Process heading 1 block
   */
  processHeading1(block) {
    const text = this.extractRichText(block.heading_1.rich_text);
    const id = this.generateHeadingId(text);
    
    return `<h1 id="${id}" class="text-4xl mt-[57px] mb-3 font-serif">${text}</h1>`;
  }

  /**
   * Process heading 2 block
   */
  processHeading2(block) {
    const text = this.extractRichText(block.heading_2.rich_text);
    const id = this.generateHeadingId(text);
    
    return `<h2 id="${id}" class="text-xl mt-[10px] mb-2 font-serif underline underline-offset-4">${text}</h2>`;
  }

  /**
   * Process heading 3 block
   */
  processHeading3(block) {
    const text = this.extractRichText(block.heading_3.rich_text);
    const id = this.generateHeadingId(text);
    
    return `<h3 id="${id}" class="text-lg mt-2 mb-2 font-serif font-semibold">${text}</h3>`;
  }

  /**
   * Process bulleted list item
   */
  async processBulletedListItem(block) {
    const text = this.extractRichText(block.bulleted_list_item.rich_text);
    let listItemHtml = `  <li class="font-serif text-lg">${text}`;
    
    // Check for nested blocks (like code blocks)
    if (block.has_children) {
      try {
        const NotionClient = require('./notion-client');
        const client = new NotionClient();
        const children = await client.getPageBlocks(block.id);
        
        for (const child of children) {
          if (child.type === 'code') {
            const childHtml = await this.processBlock(child);
            listItemHtml += childHtml;
          }
        }
      } catch (error) {
        console.warn(`Failed to process children for list item ${block.id}:`, error.message);
      }
    }
    
    listItemHtml += `</li>`;
    return listItemHtml;
  }

  /**
   * Process numbered list item
   */
  async processNumberedListItem(block) {
    const text = this.extractRichText(block.numbered_list_item.rich_text);
    let listItemHtml = `  <li class="font-serif text-lg">${text}`;
    
    // Check for nested blocks (like code blocks)
    if (block.has_children) {
      try {
        const NotionClient = require('./notion-client');
        const client = new NotionClient();
        const children = await client.getPageBlocks(block.id);
        
        for (const child of children) {
          if (child.type === 'code') {
            const childHtml = await this.processBlock(child);
            listItemHtml += childHtml;
          }
        }
      } catch (error) {
        console.warn(`Failed to process children for list item ${block.id}:`, error.message);
      }
    }
    
    listItemHtml += `</li>`;
    return listItemHtml;
  }

  /**
   * Process code block
   */
  processCodeBlock(block) {
    const code = this.extractRichText(block.code.rich_text);
    const language = block.code.language || 'text';
    
    return this.renderCodeBlock(code, language);
  }

  /**
   * Process quote block
   */
  processQuote(block) {
    const text = this.extractRichText(block.quote.rich_text);
    
    return `<blockquote class="border-l-3 border-gray-300 pl-4 my-6 text-gray-700 font-serif text-lg bg-gray-50 py-3 rounded-r-md">${text}</blockquote>`;
  }

  /**
   * Process callout block
   */
  processCallout(block) {
    const text = this.extractRichText(block.callout.rich_text);
    const icon = block.callout.icon?.emoji || '💡';
    
    return `<div class="bg-gray-50 border border-gray-200 p-4 my-6 rounded-lg">
      <div class="flex items-start gap-3">
        <span class="text-lg mt-0.5 flex-shrink-0">${icon}</span>
        <div class="font-serif text-gray-700 leading-relaxed">${text}</div>
      </div>
    </div>`;
  }

  /**
   * Process image block
   * Handles all three Notion file types: file, file_upload, external
   */
  async processImage(block) {
    // Handle different Notion file object types per official API docs
    let imageUrl;
    
    if (block.image.type === 'file') {
      // Notion-hosted file (expires after 1 hour)
      imageUrl = block.image.file?.url;
    } else if (block.image.type === 'file_upload') {
      // File uploaded via API (permanent, reference by ID)
      // TODO: Implement file_upload handling if needed
      logger.warn('File upload type not yet implemented, skipping image');
      return '';
    } else if (block.image.type === 'external') {
      // External file (permanent URL)
      imageUrl = block.image.external?.url;
    } else {
      // Fallback for legacy format
      imageUrl = block.image.file?.url || block.image.external?.url;
    }
    
    const caption = block.image.caption ? this.extractRichText(block.image.caption) : '';
    
    if (!imageUrl) return '';

    // Process and cache the image following Notion's recommendations
    const optimizedUrl = await this.processImageUrl(imageUrl);
    
    const captionHtml = caption ? `<figcaption class="text-center text-sm text-gray-600 mt-2 font-serif">${caption}</figcaption>` : '';
    
    return `<figure class="my-8">
      <img src="${optimizedUrl}" alt="${caption}" class="mx-auto rounded-lg shadow-md max-w-full h-auto" loading="lazy" />
      ${captionHtml}
    </figure>`;
  }

  /**
   * Process equation block
   */
  processEquation(block) {
    const expression = block.equation.expression;
    
    return `<div class="my-6 text-center">
      <span class="font-serif">\\[ ${expression} \\]</span>
    </div>`;
  }

  /**
   * Process table block
   */
  processTable(_block) {
    // Note: Table processing would require additional API calls to get table rows
    // This is a simplified version
    return `<div class="my-6 overflow-x-auto">
      <div class="bg-orange-50 p-4 rounded-lg border">
        <p class="font-serif text-lg">📊 Table content (processing not yet implemented)</p>
      </div>
    </div>`;
  }

  /**
   * Process divider block
   */
  processDivider(_block) {
    return `<hr class="my-8 border-gray-300" />`;
  }

  /**
   * Process bookmark block
   */
  processBookmark(block) {
    const url = block.bookmark.url;
    const caption = block.bookmark.caption ? this.extractRichText(block.bookmark.caption) : url;
    
    return `<div class="my-6 p-4 border border-orange-200 rounded-lg bg-orange-50">
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="font-serif text-lg text-blue-600 hover:text-blue-800 underline">
        🔗 ${caption}
      </a>
    </div>`;
  }

  /**
   * Process embed block
   */
  processEmbed(block) {
    const url = block.embed.url;
    
    // Simple embed handling - could be enhanced for specific services
    return `<div class="my-6">
      <iframe src="${url}" class="w-full h-96 rounded-lg" frameborder="0" allowfullscreen></iframe>
    </div>`;
  }

  /**
   * Extract rich text content with formatting
   * @param {Array} richText - Notion rich text array
   * @returns {string} HTML formatted text
   */
  extractRichText(richText) {
    if (!richText || !Array.isArray(richText)) return '';

    return richText.map(textObj => {
      let text = textObj.plain_text;
      
      // Apply formatting
      if (textObj.annotations) {
        const annotations = textObj.annotations;
        
        if (annotations.bold) text = `<strong>${text}</strong>`;
        if (annotations.italic) text = `<em>${text}</em>`;
        if (annotations.strikethrough) text = `<del>${text}</del>`;
        if (annotations.underline) text = `<u>${text}</u>`;
        if (annotations.code) text = `<code class="bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono text-sm text-gray-800">${text}</code>`;
      }
      
      // Handle links
      if (textObj.href) {
        text = `<a href="${textObj.href}" class="text-blue-600 hover:text-blue-800 underline underline-offset-2" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      
      return text;
    }).join('');
  }

  /**
   * Generate heading ID for anchors
   * @param {string} text - Heading text
   * @returns {string} URL-safe ID
   */
  generateHeadingId(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  /**
   * Get CSS classes for heading levels
   * @param {number} level - Heading level
   * @returns {string} CSS classes
   */
  getHeadingClasses(level) {
    const classes = {
      1: 'text-4xl mt-[57px] mb-3 font-serif',
      2: 'text-xl mt-[10px] mb-2 font-serif underline underline-offset-4',
      3: 'text-lg mt-2 mb-2 font-serif font-semibold',
      4: 'text-base mt-2 mb-1 font-serif font-semibold',
      5: 'text-sm mt-1 mb-1 font-serif font-semibold',
      6: 'text-xs mt-1 mb-1 font-serif font-semibold'
    };
    
    return classes[level] || classes[3];
  }

  /**
   * Render code block with syntax highlighting
   * @param {string} code - Code content
   * @param {string} language - Programming language
   * @returns {string} HTML for code block
   */
  renderCodeBlock(code, language) {
    // Minimalist code block inspired by Notion
    return `<div class="my-6">
      <pre class="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-lg overflow-x-auto font-mono text-sm leading-relaxed"><code class="language-${language}">${this.escapeHtml(code)}</code></pre>
    </div>`;
  }

  /**
   * Open list tag
   * @param {string} listType - 'ul' or 'ol'
   * @returns {string} Opening list tag
   */
  openList(listType) {
    const classes = listType === 'ol' ? 'list-decimal ml-8' : 'list-disc ml-4 font-serif';
    return `<${listType} class="${classes}">`;
  }

  /**
   * Close list tag
   * @param {string} listType - 'ul' or 'ol'
   * @returns {string} Closing list tag
   */
  closeList(listType) {
    return `</${listType}>`;
  }

  /**
   * Process image URL following Notion's strict recommendations
   * Note: Notion says "Don't cache URLs, re-fetch file objects"
   * For static sites, we either download images OR accept potential expiration
   * @param {string} imageUrl - Original Notion image URL
   * @returns {Promise<string>} Image URL (may expire for Notion-hosted files)
   */
  async processImageUrl(imageUrl) {
    try {
      // Check if it's a Notion-hosted file (these expire after 1 hour per Notion docs)
      const isNotionHosted = imageUrl.includes('s3.us-west-2.amazonaws.com') || 
                            imageUrl.includes('notion.so');
      
      if (!isNotionHosted) {
        // External files (type: external) - these are permanent URLs, return as-is
        logger.debug(`Using external image URL: ${imageUrl}`);
        return imageUrl;
      }

      // Notion-hosted files (type: file) - using Option B: Smart Caching
      // Note: This violates Notion's "don't cache" recommendation but ensures images never break
      // Perfect for static sites with periodic sync schedules
      const fs = require('fs-extra');
      const crypto = require('crypto');
      const config = require('../../config/site.config');

      // Create stable filename from URL (excluding expiry params)
      const baseUrl = imageUrl.split('?')[0];
      const urlHash = crypto.createHash('md5').update(baseUrl).digest('hex');
      const extension = this.getImageExtension(baseUrl);
      const filename = `${urlHash}${extension}`;
      
      const imagesDir = path.join(process.cwd(), config.build.outputDir, 'images', 'notion');
      const localPath = path.join(imagesDir, filename);
      const publicUrl = `/images/notion/${filename}`;

      // Track this image as "in use" for cleanup purposes
      if (!this.usedImages) this.usedImages = new Set();
      this.usedImages.add(filename);

      if (await fs.pathExists(localPath)) {
        logger.debug(`Using cached Notion image: ${filename}`);
        return publicUrl;
      }

      await fs.ensureDir(imagesDir);
      await this.downloadImage(imageUrl, localPath);
      
      logger.info(`Downloaded Notion image: ${filename}`);
      return publicUrl;

    } catch (error) {
      logger.warn(`Failed to process image ${imageUrl}, using original URL`, error);
      return imageUrl;
    }
  }

  /**
   * Download image from URL to local path
   * @param {string} url - Image URL
   * @param {string} localPath - Local file path
   * @returns {Promise<void>}
   */
  async downloadImage(url, localPath) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const fs = require('fs');
        const fileStream = fs.createWriteStream(localPath);
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        
        fileStream.on('error', (error) => {
          fs.unlink(localPath, () => {}); // Clean up on error
          reject(error);
        });
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Image download timeout'));
      });
    });
  }

  /**
   * Get file extension from image URL
   * @param {string} url - Image URL
   * @returns {string} File extension with dot
   */
  getImageExtension(url) {
    const urlWithoutQuery = url.split('?')[0];
    const extension = path.extname(urlWithoutQuery).toLowerCase();
    
    // Default to .jpg if no extension found
    if (!extension || !['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(extension)) {
      return '.jpg';
    }
    
    return extension;
  }

  /**
   * Calculate estimated reading time
   * @param {string} html - HTML content
   * @returns {number} Reading time in minutes
   */
  calculateReadingTime(html) {
    const text = html.replace(/<[^>]*>/g, ''); // Strip HTML tags
    const words = text.split(/\s+/).length;
    const wordsPerMinute = 200; // Average reading speed
    
    return Math.ceil(words / wordsPerMinute);
  }

  /**
   * Count words in HTML content
   * @param {string} html - HTML content
   * @returns {number} Word count
   */
  countWords(html) {
    if (!html) return 0;
    
    // Strip HTML tags and decode entities  
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ');
    
    // Split on whitespace and filter out empty strings
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    
    return words.length;
  }

  /**
   * Generate table of contents from headings
   * @param {string} html - HTML content
   * @returns {Array} Table of contents entries
   */
  generateTableOfContents(html) {
    const doc = parse(html);
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    return headings.map(heading => ({
      level: parseInt(heading.tagName.substring(1)),
      text: heading.innerText,
      id: heading.getAttribute('id'),
      anchor: `#${heading.getAttribute('id')}`
    }));
  }

  /**
   * Extract excerpt from content
   * @param {string} html - HTML content
   * @param {number} maxLength - Maximum excerpt length
   * @returns {string} Excerpt text
   */
  extractExcerpt(html, maxLength = 200) {
    const text = html.replace(/<[^>]*>/g, ''); // Strip HTML tags
    
    if (text.length <= maxLength) return text;
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.7) {
      return text.substring(0, lastSentence + 1);
    }
    
    // If no good sentence break, truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return text.substring(0, lastSpace) + '...';
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    
    return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
  }

  /**
   * Clean up unused cached images (for Option B)
   * Call this after processing all posts to remove orphaned images
   */
  async cleanupUnusedImages() {
    if (!this.usedImages) {
      logger.debug('No image tracking enabled, skipping cleanup');
      return [];
    }

    try {
      const fs = require('fs-extra');
      const path = require('path');
      const config = require('../../config/site.config');
      
      const imagesDir = path.join(process.cwd(), config.build.outputDir, 'images', 'notion');
      
      if (!await fs.pathExists(imagesDir)) {
        return [];
      }

      const existingFiles = await fs.readdir(imagesDir);
      const deletedFiles = [];

      for (const file of existingFiles) {
        if (!this.usedImages.has(file)) {
          await fs.remove(path.join(imagesDir, file));
          logger.debug(`Cleaned up unused image: ${file}`);
          deletedFiles.push(file);
        }
      }

      if (deletedFiles.length > 0) {
        logger.info(`Cleaned up ${deletedFiles.length} unused cached images`);
      }

      // Reset for next sync
      this.usedImages.clear();
      
      return deletedFiles;
      
    } catch (error) {
      logger.warn('Failed to cleanup unused images', error);
      return [];
    }
  }
}

module.exports = ContentProcessor; 