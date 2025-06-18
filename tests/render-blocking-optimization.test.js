const fs = require('fs').promises;
const path = require('path');
const SiteBuilder = require('../scripts/build-site');

describe('Render-Blocking Resources Optimization', () => {
  let siteBuilder;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = path.join(__dirname, 'temp', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    // Create required directories
    await fs.mkdir(path.join(tempDir, 'templates'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'content'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'static'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'static', 'css'), { recursive: true });

    siteBuilder = new SiteBuilder({
      contentDir: path.join(tempDir, 'content'),
      templatesDir: path.join(tempDir, 'templates'),
      outputDir: path.join(tempDir, 'output'),
      staticDir: path.join(tempDir, 'static')
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Critical CSS Generation', () => {
    test('should generate critical CSS file', async () => {
      const criticalPath = await siteBuilder.generateCriticalCSS();
      
      expect(await fs.access(criticalPath).then(() => true).catch(() => false)).toBe(true);
      
      const content = await fs.readFile(criticalPath, 'utf8');
      expect(content).toContain(':root');
      expect(content).toContain('--warm-bg-primary');
      expect(content).toContain('nav');
      expect(content).toContain('.w-full');
    });

    test('should include essential layout styles in critical CSS', async () => {
      await siteBuilder.generateCriticalCSS();
      
      const criticalPath = path.join(siteBuilder.staticDir, 'css', 'critical.css');
      const content = await fs.readFile(criticalPath, 'utf8');
      
      // Check for essential styles
      expect(content).toContain('body {');
      expect(content).toContain('nav {');
      expect(content).toContain('.mx-auto');
      expect(content).toContain('.font-serif');
      expect(content).toContain('@media (min-width: 768px)');
    });
  });

  describe('Non-Critical CSS Generation', () => {
    test('should generate non-critical CSS file', async () => {
      const nonCriticalPath = await siteBuilder.generateNonCriticalCSS();
      
      expect(await fs.access(nonCriticalPath).then(() => true).catch(() => false)).toBe(true);
      
      const content = await fs.readFile(nonCriticalPath, 'utf8');
      expect(content).toContain('Non-critical CSS');
      expect(content).toContain('.non-critical');
      expect(content).toContain('Progressive enhancement');
    });

    test('should handle missing custom CSS gracefully', async () => {
      const nonCriticalPath = await siteBuilder.generateNonCriticalCSS();
      
      const content = await fs.readFile(nonCriticalPath, 'utf8');
      expect(content).toContain('Non-critical CSS');
      expect(content).toContain('.non-critical');
      
      // Should still include progressive enhancement styles
      expect(content).toContain('opacity: 1');
      expect(content).toContain('transition: opacity');
    });
  });

  describe('Performance Impact', () => {
    test('should reduce critical path size', async () => {
      await siteBuilder.generateCriticalCSS();
      
      const criticalPath = path.join(siteBuilder.staticDir, 'css', 'critical.css');
      const criticalStats = await fs.stat(criticalPath);
      
      // Critical CSS should be smaller than 15KB for fast loading
      expect(criticalStats.size).toBeLessThan(15 * 1024);
    });

    test('should maintain visual consistency', async () => {
      await siteBuilder.generateCriticalCSS();
      
      const criticalContent = await fs.readFile(
        path.join(siteBuilder.staticDir, 'css', 'critical.css'),
        'utf8'
      );
      
      // Should include color variables
      expect(criticalContent).toContain('--warm-bg-primary: #fefbf3');
      expect(criticalContent).toContain('--warm-text-primary: #2d1b0f');
      
      // Should include basic typography
      expect(criticalContent).toContain('font-family: ui-serif');
      expect(criticalContent).toContain('line-height: 1.6');
    });
  });
}); 