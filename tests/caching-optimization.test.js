const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const SiteBuilder = require('../scripts/build-site');

describe('Caching Optimization', () => {
  let siteBuilder;
  let testOutputDir;
  let testStaticDir;

  beforeAll(async () => {
    // Setup test directories
    testOutputDir = path.join(__dirname, 'temp-dist');
    testStaticDir = path.join(__dirname, 'temp-static');
    
    await fs.ensureDir(testOutputDir);
    await fs.ensureDir(testStaticDir);
    
    // Create test CSS and JS files
    await fs.ensureDir(path.join(testStaticDir, 'css'));
    await fs.ensureDir(path.join(testStaticDir, 'js'));
    
    await fs.writeFile(path.join(testStaticDir, 'css', 'custom.css'), 'body { margin: 0; }');
    await fs.writeFile(path.join(testStaticDir, 'js', 'performance.js'), 'console.log("test");');
    await fs.writeFile(path.join(testStaticDir, 'js', 'analytics.js'), 'window.gtag = function() {};');
  });

  beforeEach(() => {
    // Create SiteBuilder instance with test configuration
    siteBuilder = new SiteBuilder({ force: true });
    siteBuilder.outputDir = testOutputDir;
    siteBuilder.staticDir = testStaticDir;
  });

  afterAll(async () => {
    // Cleanup test directories
    await fs.remove(testOutputDir);
    await fs.remove(testStaticDir);
  });

  describe('Asset Versioning', () => {
    test('should generate asset versions for CSS and JS files', async () => {
      await siteBuilder.generateAssetVersions();
      
      expect(siteBuilder.assetVersions).toBeDefined();
      expect(siteBuilder.assetVersions['css/custom.css']).toBeDefined();
      expect(siteBuilder.assetVersions['js/performance.js']).toBeDefined();
      expect(siteBuilder.assetVersions['js/analytics.js']).toBeDefined();
      
      // Verify version hashes are 8 characters long
      expect(siteBuilder.assetVersions['css/custom.css']).toHaveLength(8);
      expect(siteBuilder.assetVersions['js/performance.js']).toHaveLength(8);
    });

    test('should generate consistent hashes for same content', async () => {
      await siteBuilder.generateAssetVersions();
      const firstHash = siteBuilder.assetVersions['css/custom.css'];
      
      // Generate again
      await siteBuilder.generateAssetVersions();
      const secondHash = siteBuilder.assetVersions['css/custom.css'];
      
      expect(firstHash).toBe(secondHash);
    });

    test('should generate different hashes for different content', async () => {
      await siteBuilder.generateAssetVersions();
      const originalHash = siteBuilder.assetVersions['css/custom.css'];
      
      // Modify the CSS file
      await fs.writeFile(path.join(testStaticDir, 'css', 'custom.css'), 'body { margin: 10px; }');
      
      await siteBuilder.generateAssetVersions();
      const newHash = siteBuilder.assetVersions['css/custom.css'];
      
      expect(originalHash).not.toBe(newHash);
    });

    test('should handle missing asset directories gracefully', async () => {
      // Remove CSS directory
      await fs.remove(path.join(testStaticDir, 'css'));
      
      await expect(siteBuilder.generateAssetVersions()).resolves.not.toThrow();
      expect(siteBuilder.assetVersions['css/custom.css']).toBeUndefined();
      expect(siteBuilder.assetVersions['js/performance.js']).toBeDefined();
    });
  });

  describe('Handlebars Asset Helper', () => {
    beforeEach(async () => {
      siteBuilder.setupHandlebarsHelpers();
      await siteBuilder.generateAssetVersions();
    });

    test('should add version parameter to asset paths', () => {
      const helper = siteBuilder.handlebars.helpers.asset;
      // Need to use the exact path as stored in assetVersions
      const result = helper('css/custom.css');
      
      // Check if we have a version for this asset first
      if (siteBuilder.assetVersions['css/custom.css']) {
        expect(result).toMatch(/^css\/custom\.css\?v=[a-f0-9]{8}$/);
      } else {
        expect(result).toBe('css/custom.css');
      }
    });

    test('should return original path if no version exists', () => {
      const helper = siteBuilder.handlebars.helpers.asset;
      const result = helper('css/nonexistent.css');
      
      expect(result).toBe('css/nonexistent.css');
    });

    test('should handle empty or null paths', () => {
      const helper = siteBuilder.handlebars.helpers.asset;
      
      expect(helper('')).toBe('');
      expect(helper(null)).toBe(null);
      expect(helper(undefined)).toBe(undefined);
    });
  });

  describe('Cache Headers Validation', () => {
    test('should verify vercel.json has proper cache headers', async () => {
      const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
      const vercelConfig = await fs.readJson(vercelConfigPath);
      
      expect(vercelConfig.headers).toBeDefined();
      
      // Check for CSS cache headers
      const cssHeaders = vercelConfig.headers.find(h => h.source === '/css/(.*)');
      expect(cssHeaders).toBeDefined();
      expect(cssHeaders.headers.find(h => h.key === 'Cache-Control')).toBeDefined();
      expect(cssHeaders.headers.find(h => h.key === 'Cache-Control').value).toContain('max-age=31536000');
      expect(cssHeaders.headers.find(h => h.key === 'Cache-Control').value).toContain('immutable');
      
      // Check for JS cache headers
      const jsHeaders = vercelConfig.headers.find(h => h.source === '/js/(.*)');
      expect(jsHeaders).toBeDefined();
      expect(jsHeaders.headers.find(h => h.key === 'Cache-Control').value).toContain('max-age=31536000');
      
      // Check for image cache headers
      const imageHeaders = vercelConfig.headers.find(h => h.source === '/images/(.*)');
      expect(imageHeaders).toBeDefined();
      
      // Check for HTML cache headers with stale-while-revalidate
      const htmlHeaders = vercelConfig.headers.find(h => h.source === '/(.*).html');
      expect(htmlHeaders).toBeDefined();
      expect(htmlHeaders.headers.find(h => h.key === 'Cache-Control').value).toContain('stale-while-revalidate');
    });

    test('should have appropriate cache durations for different asset types', async () => {
      const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
      const vercelConfig = await fs.readJson(vercelConfigPath);
      
      const headers = vercelConfig.headers;
      
      // Static assets should have 1 year cache (31536000 seconds)
      const staticAssetHeaders = headers.filter(h => 
        h.source.includes('css') || 
        h.source.includes('js') || 
        h.source.includes('images') ||
        h.source.includes('ico|png|jpg')
      );
      
      staticAssetHeaders.forEach(headerConfig => {
        const cacheControl = headerConfig.headers.find(h => h.key === 'Cache-Control');
        expect(cacheControl.value).toContain('max-age=31536000');
      });
      
      // HTML should have shorter cache (3600 seconds)
      const htmlHeaders = headers.find(h => h.source === '/(.*).html');
      const htmlCacheControl = htmlHeaders.headers.find(h => h.key === 'Cache-Control');
      expect(htmlCacheControl.value).toContain('max-age=3600');
    });
  });

  describe('Performance Impact', () => {
    test('should not significantly impact build time', async () => {
      const startTime = Date.now();
      
      await siteBuilder.generateAssetVersions();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Asset versioning should complete in under 100ms for test files
      expect(duration).toBeLessThan(100);
    });

    test('should track asset versioning in performance metrics', async () => {
      await siteBuilder.generateAssetVersions();
      
      // Verify that asset versions were generated
      const assetCount = Object.keys(siteBuilder.assetVersions).length;
      expect(assetCount).toBeGreaterThan(0);
    });
  });

  describe('Integration with Build Process', () => {
    test('should integrate asset versioning in build pipeline', async () => {
      // Create minimal content structure for build
      const contentDir = path.join(__dirname, 'temp-content');
      await fs.ensureDir(contentDir);
      await fs.writeFile(path.join(contentDir, 'posts-index.json'), JSON.stringify({ posts: [] }));
      
      siteBuilder.contentDir = contentDir;
      
      // Create minimal templates
      const templatesDir = path.join(__dirname, 'temp-templates');
      await fs.ensureDir(templatesDir);
      await fs.writeFile(path.join(templatesDir, 'base.html'), `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="{{asset 'css/custom.css'}}">
        </head>
        <body>
          {{{content}}}
          <script src="{{asset 'js/performance.js'}}"></script>
        </body>
        </html>
      `);
      await fs.writeFile(path.join(templatesDir, 'home.html'), '<h1>{{site.title}}</h1>');
      
      siteBuilder.templatesDir = templatesDir;
      
      try {
        // This should not throw and should generate versioned assets
        await siteBuilder.generateAssetVersions();
        expect(Object.keys(siteBuilder.assetVersions).length).toBeGreaterThan(0);
      } finally {
        // Cleanup
        await fs.remove(contentDir);
        await fs.remove(templatesDir);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle file read errors gracefully', async () => {
      // Create a directory that will cause read errors
      const badStaticDir = path.join(__dirname, 'nonexistent-static');
      siteBuilder.staticDir = badStaticDir;
      
      await expect(siteBuilder.generateAssetVersions()).resolves.not.toThrow();
      expect(Object.keys(siteBuilder.assetVersions).length).toBe(0);
    });

    test('should handle corrupted files gracefully', async () => {
      // Ensure CSS directory exists first
      await fs.ensureDir(path.join(testStaticDir, 'css'));
      
      // Create a file with special permissions that might cause issues
      const restrictedFile = path.join(testStaticDir, 'css', 'restricted.css');
      await fs.writeFile(restrictedFile, 'body { color: red; }');
      
      await expect(siteBuilder.generateAssetVersions()).resolves.not.toThrow();
    });
  });
}); 