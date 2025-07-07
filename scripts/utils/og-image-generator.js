const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const logger = require('./logger');

/**
 * OG Image Generator - Creates branded Open Graph images for social media sharing
 * Following best practices: 1200x630px, branded design, clear typography
 */
class OGImageGenerator {
  constructor(config) {
    this.config = config;
    this.width = 1200;
    this.height = 630;
    this.outputDir = path.join(process.cwd(), config.build.outputDir, 'og-images');
  }

  /**
   * Initialize the generator and create output directory
   */
  async initialize() {
    await fs.ensureDir(this.outputDir);
    logger.debug('OG image output directory ensured');
  }

  /**
   * Generate OG image for a blog post
   * @param {Object} post - Post data including title, category, author
   * @param {Object} options - Additional options like forceRegenerate
   * @returns {Promise<string>} - Relative path to generated image
   */
  async generatePostImage(post, options = {}) {
    const filename = `post-${post.slug}.png`;
    const outputPath = path.join(this.outputDir, filename);
    const relativePath = `/og-images/${filename}`;

    // Skip if already exists and not forcing regeneration
    if (!options.forceRegenerate && await fs.pathExists(outputPath)) {
      logger.debug(`OG image already exists: ${filename}`);
      return relativePath;
    }

    try {
      // Create base canvas with gradient background
      const background = await this.createGradientBackground();
      
      // Create the main content overlay
      const contentOverlay = await this.createPostContentOverlay(post);
      
      // Combine background and content
      const finalImage = await background
        .composite([{ input: contentOverlay, top: 0, left: 0 }])
        .png()
        .toFile(outputPath);

      logger.debug(`Generated OG image: ${filename}`);
      return relativePath;

    } catch (error) {
      logger.error(`Failed to generate OG image for post ${post.slug}`, error);
      return this.getFallbackImage();
    }
  }

  /**
   * Generate OG image for category pages
   * @param {Object} category - Category data
   * @returns {Promise<string>} - Relative path to generated image
   */
  async generateCategoryImage(category) {
    const filename = `category-${category.slug}.png`;
    const outputPath = path.join(this.outputDir, filename);
    const relativePath = `/og-images/${filename}`;

    if (await fs.pathExists(outputPath)) {
      return relativePath;
    }

    try {
      const background = await this.createGradientBackground();
      const contentOverlay = await this.createCategoryContentOverlay(category);
      
      await background
        .composite([{ input: contentOverlay, top: 0, left: 0 }])
        .png()
        .toFile(outputPath);

      logger.debug(`Generated category OG image: ${filename}`);
      return relativePath;

    } catch (error) {
      logger.error(`Failed to generate category OG image for ${category.slug}`, error);
      return this.getFallbackImage();
    }
  }

  /**
   * Generate default/fallback OG image for the site
   * @returns {Promise<string>} - Relative path to generated image
   */
  async generateDefaultImage() {
    const filename = 'default.png';
    const outputPath = path.join(this.outputDir, filename);
    const relativePath = `/og-images/${filename}`;

    if (await fs.pathExists(outputPath)) {
      return relativePath;
    }

    try {
      const background = await this.createGradientBackground();
      const contentOverlay = await this.createDefaultContentOverlay();
      
      await background
        .composite([{ input: contentOverlay, top: 0, left: 0 }])
        .png()
        .toFile(outputPath);

      logger.info(`Generated default OG image: ${filename}`);
      return relativePath;

    } catch (error) {
      logger.error('Failed to generate default OG image', error);
      return '/images/avatar.png'; // Ultimate fallback
    }
  }

  /**
   * Create gradient background for OG images
   * Professional warm gradient that matches the blog's aesthetic
   */
  async createGradientBackground() {
    // Create an SVG gradient background
    const gradientSvg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FFF7ED;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#FFEDD5;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FED7AA;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        
        <!-- Subtle pattern overlay -->
        <rect width="100%" height="100%" fill="url(#pattern)" opacity="0.1" />
        
        <!-- Brand accent line -->
        <rect x="0" y="0" width="8" height="${this.height}" fill="#EA580C" />
      </svg>
    `;

    return sharp(Buffer.from(gradientSvg)).png();
  }

  /**
   * Create content overlay for blog posts
   */
  async createPostContentOverlay(post) {
    const contentSvg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .title { font-family: Georgia, serif; font-size: 54px; font-weight: bold; fill: #1F2937; }
            .subtitle { font-family: Georgia, serif; font-size: 28px; fill: #6B7280; }
            .meta { font-family: Georgia, serif; font-size: 22px; fill: #9CA3AF; }
            .blog-name { font-family: Georgia, serif; font-size: 32px; font-weight: bold; fill: #EA580C; }
            .category { font-family: Georgia, serif; font-size: 18px; fill: #FFFFFF; }
          </style>
        </defs>
        
        <!-- Blog name -->
        <text x="60" y="80" class="blog-name">${this.escapeXml(this.config.site.title)}</text>
        
        <!-- Post title (word wrapped) -->
        ${this.createWrappedText(post.title, 60, 160, 52, '#1F2937', 1000)}
        
        <!-- Category badge -->
        <rect x="60" y="${this.height - 120}" width="${this.getTextWidth(post.category) + 24}" height="36" rx="18" fill="#EA580C" />
        <text x="${60 + 12}" y="${this.height - 96}" class="category">${this.escapeXml(post.category)}</text>
        
        <!-- Author and meta info -->
        <text x="60" y="${this.height - 50}" class="meta">by ${this.escapeXml(this.config.author.name)}</text>
        ${post.readingTime ? `<text x="60" y="${this.height - 20}" class="meta">${post.readingTime} min read</text>` : ''}
      </svg>
    `;

    return Buffer.from(contentSvg);
  }

  /**
   * Create content overlay for category pages
   */
  async createCategoryContentOverlay(category) {
    const contentSvg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .title { font-family: Georgia, serif; font-size: 64px; font-weight: bold; fill: #1F2937; }
            .subtitle { font-family: Georgia, serif; font-size: 32px; fill: #6B7280; }
            .blog-name { font-family: Georgia, serif; font-size: 28px; font-weight: bold; fill: #EA580C; }
          </style>
        </defs>
        
        <!-- Blog name -->
        <text x="60" y="80" class="blog-name">${this.escapeXml(this.config.site.title)}</text>
        
        <!-- Category title -->
        <text x="60" y="200" class="title">${this.escapeXml(category.name)}</text>
        
        <!-- Category description -->
        ${category.description ? `<text x="60" y="270" class="subtitle">${this.escapeXml(category.description)}</text>` : ''}
        
        <!-- Bottom meta -->
        <text x="60" y="${this.height - 50}" class="subtitle">Browse ${category.name} posts</text>
      </svg>
    `;

    return Buffer.from(contentSvg);
  }

  /**
   * Create content overlay for default/homepage
   */
  async createDefaultContentOverlay() {
    const contentSvg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .title { font-family: Georgia, serif; font-size: 72px; font-weight: bold; fill: #1F2937; }
            .subtitle { font-family: Georgia, serif; font-size: 36px; fill: #6B7280; }
            .meta { font-family: Georgia, serif; font-size: 24px; fill: #9CA3AF; }
          </style>
        </defs>
        
        <!-- Main title -->
        <text x="60" y="200" class="title">${this.escapeXml(this.config.site.title)}</text>
        
        <!-- Site description -->
        <text x="60" y="280" class="subtitle">${this.escapeXml(this.config.site.description)}</text>
        
        <!-- Author -->
        <text x="60" y="${this.height - 80}" class="meta">by ${this.escapeXml(this.config.author.name)}</text>
        <text x="60" y="${this.height - 40}" class="meta">${this.escapeXml(this.config.author.bio)}</text>
      </svg>
    `;

    return Buffer.from(contentSvg);
  }

  /**
   * Create wrapped text for long titles
   */
  createWrappedText(text, x, startY, fontSize, color, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    // Simple word wrapping (approximate)
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Rough character width estimation
      if (testLine.length * (fontSize * 0.6) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limit to 3 lines max
    const finalLines = lines.slice(0, 3);
    if (lines.length > 3) {
      finalLines[2] = finalLines[2].substring(0, finalLines[2].length - 3) + '...';
    }

    return finalLines.map((line, index) => 
      `<text x="${x}" y="${startY + (index * (fontSize + 10))}" style="font-family: Georgia, serif; font-size: ${fontSize}px; font-weight: bold; fill: ${color};">${this.escapeXml(line)}</text>`
    ).join('\n');
  }

  /**
   * Get approximate text width for centering
   */
  getTextWidth(text) {
    return text.length * 12; // Rough approximation
  }

  /**
   * Escape XML special characters
   */
  escapeXml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get fallback image path
   */
  getFallbackImage() {
    return '/images/avatar.png';
  }

  /**
   * Clean up old OG images that are no longer needed
   */
  async cleanupOldImages(currentSlugs = []) {
    try {
      const files = await fs.readdir(this.outputDir);
      const ogFiles = files.filter(file => file.startsWith('post-') && file.endsWith('.png'));
      
      for (const file of ogFiles) {
        const slug = file.replace('post-', '').replace('.png', '');
        if (!currentSlugs.includes(slug)) {
          await fs.remove(path.join(this.outputDir, file));
          logger.debug(`Cleaned up old OG image: ${file}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old OG images', error);
    }
  }
}

module.exports = OGImageGenerator; 