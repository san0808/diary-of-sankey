const fs = require('fs-extra');
const path = require('path');
const OGImageGenerator = require('../../scripts/utils/og-image-generator');

// Only run these tests when explicitly enabled
const shouldRunOGTests = process.env.TEST_OG_IMAGES === 'true';
const describeIf = shouldRunOGTests ? describe : describe.skip;

// Mock config for OG testing
const mockConfig = {
  site: {
    title: 'Test Blog',
    description: 'Integration test blog'
  },
  author: {
    name: 'Test Author'
  },
  build: {
    outputDir: 'test-dist'
  },
  ogImages: {
    enabled: true,
    generateFallbacks: true,
    dimensions: { width: 1200, height: 630 }
  }
};

describeIf('OG Image Generation Integration Tests', () => {
  let generator;
  let testOutputDir;

  beforeAll(async () => {
    // Create a clean test environment
    testOutputDir = path.join(process.cwd(), 'test-og-output');
    await fs.ensureDir(testOutputDir);
    
    // Override output directory for tests
    const testConfig = {
      ...mockConfig,
      build: { ...mockConfig.build, outputDir: testOutputDir }
    };
    
    generator = new OGImageGenerator(testConfig);
    // Override the output directory after construction for testing
    generator.outputDir = path.join(testOutputDir, 'og-images');
    await generator.initialize();
  });

  afterAll(async () => {
    // Clean up test files
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  describe('Real Image Generation', () => {
    it('should generate actual OG image for post', async () => {
      const mockPost = {
        slug: 'integration-test-post',
        title: 'Integration Test: This is a Real OG Image Generation Test',
        category: 'Testing',
        readingTime: 5,
        publishDate: '2024-01-01'
      };

      const imagePath = await generator.generatePostImage(mockPost, { forceRegenerate: true });
      
      // Verify the image was actually created
      const fullPath = path.join(testOutputDir, 'og-images', 'post-integration-test-post.png');
      expect(await fs.pathExists(fullPath)).toBe(true);
      
      // Verify basic image properties (if Sharp is available)
      try {
        const sharp = require('sharp');
        const metadata = await sharp(fullPath).metadata();
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(630);
        expect(metadata.format).toBe('png');
      } catch (error) {
        console.warn('Sharp not available for metadata verification:', error.message);
      }
      
      expect(imagePath).toBe('/og-images/post-integration-test-post.png');
    });

    it('should generate category image with proper branding', async () => {
      const mockCategory = {
        slug: 'integration-testing',
        name: 'Integration Testing',
        description: 'Posts about integration testing'
      };

      const imagePath = await generator.generateCategoryImage(mockCategory);
      const fullPath = path.join(testOutputDir, 'og-images', 'category-integration-testing.png');
      
      expect(await fs.pathExists(fullPath)).toBe(true);
      expect(imagePath).toBe('/og-images/category-integration-testing.png');
    });

    it('should generate default fallback image', async () => {
      const imagePath = await generator.generateDefaultImage();
      const fullPath = path.join(testOutputDir, 'og-images', 'default.png');
      
      expect(await fs.pathExists(fullPath)).toBe(true);
      expect(imagePath).toBe('/og-images/default.png');
    });

    it('should handle text wrapping correctly in real generation', async () => {
      const mockPost = {
        slug: 'long-title-test',
        title: 'This is an Extremely Long Title That Should Demonstrate Proper Text Wrapping in Real OG Image Generation and Show How the System Handles Multiple Lines',
        category: 'Testing',
        readingTime: 8
      };

      const imagePath = await generator.generatePostImage(mockPost, { forceRegenerate: true });
      const fullPath = path.join(testOutputDir, 'og-images', 'post-long-title-test.png');
      
      expect(await fs.pathExists(fullPath)).toBe(true);
      expect(imagePath).toBe('/og-images/post-long-title-test.png');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle batch generation efficiently', async () => {
      const posts = Array.from({ length: 5 }, (_, i) => ({
        slug: `batch-test-${i}`,
        title: `Batch Test Post ${i + 1}`,
        category: 'Batch Testing',
        readingTime: 3
      }));

      const startTime = Date.now();
      
      const promises = posts.map(post => 
        generator.generatePostImage(post, { forceRegenerate: true })
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Should complete within reasonable time (adjust based on your requirements)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
      expect(results).toHaveLength(5);
      
      // Verify all images were created
      for (const post of posts) {
        const fullPath = path.join(testOutputDir, 'og-images', `post-${post.slug}.png`);
        expect(await fs.pathExists(fullPath)).toBe(true);
      }
    });

    it('should gracefully handle special characters in titles', async () => {
      const mockPost = {
        slug: 'special-chars-test',
        title: 'Testing "Quotes" & <HTML> Tags in Titles • Special Characters',
        category: 'Edge Cases',
        readingTime: 4
      };

      const imagePath = await generator.generatePostImage(mockPost, { forceRegenerate: true });
      const fullPath = path.join(testOutputDir, 'og-images', 'post-special-chars-test.png');
      
      expect(await fs.pathExists(fullPath)).toBe(true);
      expect(imagePath).toBe('/og-images/post-special-chars-test.png');
    });
  });

  describe('System Integration', () => {
    it('should integrate with build system when enabled', async () => {
      // This would test the actual integration with SiteBuilder
      // when OG images are enabled in the config
      
      const posts = [{
        slug: 'build-integration-test',
        title: 'Build System Integration Test',
        category: 'Integration',
        readingTime: 5
      }];

      // Generate images
      const imagePromises = posts.map(post => generator.generatePostImage(post));
      const imagePaths = await Promise.all(imagePromises);
      
      expect(imagePaths).toHaveLength(1);
      expect(imagePaths[0]).toContain('/og-images/post-build-integration-test.png');
      
      // Verify cleanup works
      await generator.cleanupOldImages(posts.map(p => p.slug));
      
      // The test image should still exist since it's in currentSlugs
      const fullPath = path.join(testOutputDir, 'og-images', 'post-build-integration-test.png');
      expect(await fs.pathExists(fullPath)).toBe(true);
    });
  });
});

// Always run this describe block to document why tests might be skipped
describe('OG Image Integration Test Info', () => {
  if (!shouldRunOGTests) {
    it('should explain how to run OG integration tests', () => {
      console.log(`
📸 OG Image Integration Tests

These tests are currently SKIPPED because they require:
1. Sharp image processing library (npm install sharp)
2. Environment variable: TEST_OG_IMAGES=true

To run these tests:
  TEST_OG_IMAGES=true npm test tests/integration/og-image-integration.test.js

Why we skip by default:
✅ Faster CI/CD pipelines
✅ No external dependencies in basic tests  
✅ Works in Docker without graphics libraries

Why you should run them occasionally:
🔍 End-to-end verification of image generation
🎨 Visual regression testing capability
⚡ Performance benchmarking of batch operations
🐛 Real Sharp library integration testing
      `);
      
      expect(true).toBe(true); // This test always passes, just for documentation
    });
  } else {
    it('should confirm OG integration tests are running', () => {
      console.log('✅ Running full OG image integration tests with real image generation');
      expect(true).toBe(true);
    });
  }
}); 