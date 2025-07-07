#!/usr/bin/env node

const OGImageGenerator = require('./utils/og-image-generator');
const config = require('../config/site.config');
const logger = require('./utils/logger');

/**
 * Test script for OG image generation
 * This generates sample OG images to verify the system works correctly
 */
async function testOGGeneration() {
  logger.info('🧪 Testing OG Image Generation...');
  
  const generator = new OGImageGenerator(config);
  await generator.initialize();

  try {
    // Test default image
    logger.info('Generating default OG image...');
    const defaultImage = await generator.generateDefaultImage();
    logger.success(`Default image: ${defaultImage}`);

    // Test category images
    const categories = [
      { name: 'Blog', slug: 'blog', description: 'Personal thoughts and technical insights' },
      { name: 'Research Notes', slug: 'research-notes', description: 'Deep dives into research papers and technical concepts' },
      { name: 'Math', slug: 'math', description: 'Mathematical explorations and explanations' }
    ];

    for (const category of categories) {
      logger.info(`Generating category image for: ${category.name}`);
      const categoryImage = await generator.generateCategoryImage(category);
      logger.success(`Category image: ${categoryImage}`);
    }

    // Test sample post images
    const samplePosts = [
      {
        slug: 'test-post-1',
        title: 'How to Build Amazing Static Sites with Node.js',
        category: 'Blog',
        readingTime: 5
      },
      {
        slug: 'test-post-2', 
        title: 'Understanding Machine Learning Algorithms: A Deep Dive into Neural Networks',
        category: 'Research Notes',
        readingTime: 12
      },
      {
        slug: 'test-post-3',
        title: 'Mathematical Proof of the Pythagorean Theorem',
        category: 'Math',
        readingTime: 8
      }
    ];

    for (const post of samplePosts) {
      logger.info(`Generating post image for: ${post.title}`);
      const postImage = await generator.generatePostImage(post, { forceRegenerate: true });
      logger.success(`Post image: ${postImage}`);
    }

    logger.success('🎉 All OG images generated successfully!');
    logger.info('Check the /og-images directory in your build output to see the results.');
    logger.info('');
    logger.info('📏 Generated images are 1200x630px - perfect for social media sharing!');
    logger.info('🎨 Images use your blog\'s brand colors and typography');
    logger.info('📱 They will look great on Twitter, Facebook, LinkedIn, and other platforms');

  } catch (error) {
    logger.error('Failed to generate test OG images', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testOGGeneration()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Test failed', error);
      process.exit(1);
    });
}

module.exports = testOGGeneration; 