#!/usr/bin/env node

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const config = require('../config/site.config');

class DevServer {
  constructor() {
    this.app = express();
    this.port = process.env.DEV_PORT || 3000;
    this.publicDir = path.join(process.cwd(), config.build.outputDir);
    this.isBuilding = false;
    this.buildQueue = [];
    // Include drafts during local development builds unless explicitly disabled
    if (!process.env.DEV_INCLUDE_DRAFTS) {
      process.env.DEV_INCLUDE_DRAFTS = 'true';
    }
  }

  async start() {
    console.log(chalk.cyan.bold('\n🚀 Starting Development Server\n'));

    try {
      // Initial build
      await this.buildSite();
      
      // Setup Express server
      this.setupServer();
      
      // Setup file watchers
      this.setupWatchers();
      
      // Start server
      await this.listen();
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start dev server:'), error.message);
      process.exit(1);
    }
  }

  async buildSite() {
    if (this.isBuilding) {
      this.buildQueue.push(() => this.buildSite());
      return;
    }

    this.isBuilding = true;
    console.log(chalk.yellow('🔨 Building site...'));

    try {
      // Run the build script
      await execAsync('node scripts/build-site.js');
      console.log(chalk.green('✅ Site built successfully'));
      
      // Process any queued builds
      if (this.buildQueue.length > 0) {
        const nextBuild = this.buildQueue.shift();
        setTimeout(nextBuild, 100);
      }
    } catch (error) {
      console.error(chalk.red('❌ Build failed:'), error.message);
    } finally {
      this.isBuilding = false;
    }
  }

  setupServer() {
    // Serve static files from public directory
    this.app.use(express.static(this.publicDir));

    // Handle static assets explicitly
    this.app.get('/css/*', (req, res) => {
      const cssPath = path.join(this.publicDir, req.path);
      if (fs.existsSync(cssPath)) {
        res.sendFile(cssPath);
      } else {
        res.status(404).send('CSS file not found');
      }
    });

    // Handle specific routes before catch-all
    this.app.get('/', (req, res) => {
      const indexPath = path.join(this.publicDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Site not built yet. Building...');
        this.buildSite();
      }
    });

    // Handle category index pages
    this.app.get('/blog', (req, res) => {
      const blogIndexPath = path.join(this.publicDir, 'blog', 'index.html');
      if (fs.existsSync(blogIndexPath)) {
        res.sendFile(blogIndexPath);
      } else {
        res.status(404).send('Blog page not found');
      }
    });

    this.app.get('/research-notes', (req, res) => {
      const researchIndexPath = path.join(this.publicDir, 'research-notes', 'index.html');
      if (fs.existsSync(researchIndexPath)) {
        res.sendFile(researchIndexPath);
      } else {
        res.status(404).send('Research Notes page not found');
      }
    });

    this.app.get('/math', (req, res) => {
      const mathIndexPath = path.join(this.publicDir, 'math', 'index.html');
      if (fs.existsSync(mathIndexPath)) {
        res.sendFile(mathIndexPath);
      } else {
        res.status(404).send('Math page not found');
      }
    });

    // Handle individual post pages
    this.app.get('/:category/:slug', (req, res) => {
      const { category, slug } = req.params;
      const postPath = path.join(this.publicDir, category, `${slug}.html`);
      
      if (fs.existsSync(postPath)) {
        res.sendFile(postPath);
      } else {
        res.status(404).send(`Post not found: ${category}/${slug}`);
      }
    });

    // Handle SPA routing - serve appropriate index for directories
    this.app.get('*', (req, res) => {
      // If it's a file request (has extension), try to serve it
      if (path.extname(req.path)) {
        return res.status(404).send('File not found');
      }
      
      // For directory requests, try to serve index.html from that directory
      const requestedPath = path.join(this.publicDir, req.path, 'index.html');
      if (fs.existsSync(requestedPath)) {
        res.sendFile(requestedPath);
      } else {
        // Fallback to main index.html
        const indexPath = path.join(this.publicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Site not built yet. Building...');
          this.buildSite();
        }
      }
    });

    // Add live reload script injection
    this.app.use(this.injectLiveReload.bind(this));
  }

  injectLiveReload(req, res, next) {
    // Only inject for HTML responses
    if (req.path.endsWith('.html') || (!path.extname(req.path) && req.accepts('html'))) {
      const originalSend = res.send;
      res.send = function(body) {
        if (typeof body === 'string' && body.includes('</body>')) {
          const liveReloadScript = `
<script>
  // Simple live reload
  let lastModified = null;
  
  async function checkForUpdates() {
    try {
      const response = await fetch('/api/last-modified');
      const data = await response.json();
      
      if (lastModified && data.lastModified !== lastModified) {
        console.log('🔄 Changes detected, reloading...');
        window.location.reload();
      }
      
      lastModified = data.lastModified;
    } catch (error) {
      // Silently fail - server might be restarting
    }
  }
  
  // Check every 2 seconds
  setInterval(checkForUpdates, 2000);
  checkForUpdates();
</script>`;
          body = body.replace('</body>', liveReloadScript + '</body>');
        }
        originalSend.call(this, body);
      };
    }
    next();
  }

  setupWatchers() {
    console.log(chalk.blue('👀 Setting up file watchers...'));

    // Watch for changes in templates, content, and config
    const watchPaths = [
      'templates/**/*',
      'content/**/*',
      'config/**/*',
      'styles/**/*'
    ];

    const watcher = chokidar.watch(watchPaths, {
      ignored: [
        'node_modules/**',
        'public/**',
        '.git/**',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
      console.log(chalk.cyan(`📁 File changed: ${filePath}`));
      this.buildSite();
    });

    watcher.on('add', (filePath) => {
      console.log(chalk.green(`📁 File added: ${filePath}`));
      this.buildSite();
    });

    watcher.on('unlink', (filePath) => {
      console.log(chalk.red(`📁 File removed: ${filePath}`));
      this.buildSite();
    });

    // API endpoint for live reload
    this.app.get('/api/last-modified', (req, res) => {
      res.json({ lastModified: Date.now() });
    });

    console.log(chalk.green('✅ File watchers active'));
  }

  async listen() {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(chalk.green.bold(`\n🌐 Dev server running!\n`));
          console.log(chalk.cyan(`   Local:    http://localhost:${this.port}`));
          console.log(chalk.cyan(`   Network:  http://0.0.0.0:${this.port}`));
          console.log(chalk.gray(`\n   📁 Serving: ${this.publicDir}`));
          console.log(chalk.gray(`   👀 Watching for changes...`));
          console.log(chalk.gray(`   🔄 Auto-reload enabled\n`));
          
          console.log(chalk.yellow('💡 Tips:'));
          console.log('   • Edit your Notion database to see changes');
          console.log('   • Run "npm run sync" to fetch latest content');
          console.log('   • Press Ctrl+C to stop the server\n');
          
          resolve(server);
        }
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Shutting down dev server...'));
        server.close(() => {
          console.log(chalk.green('✅ Dev server stopped'));
          process.exit(0);
        });
      });
    });
  }
}

// Enhanced sync command for development
async function runSyncInDev() {
  console.log(chalk.blue('🔄 Running Notion sync...'));
  
  try {
    await execAsync('npm run sync');
    console.log(chalk.green('✅ Sync completed'));
  } catch (error) {
    console.error(chalk.red('❌ Sync failed:'), error.message);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
${chalk.cyan.bold('Development Server')}

${chalk.yellow('Usage:')} npm run dev [options]

${chalk.yellow('Options:')}
  --help          Show this help message
  --port <port>   Set custom port (default: 3000)
  --sync          Run initial sync before starting server

${chalk.yellow('Features:')}
  ✅ Static file serving
  ✅ Live reload on file changes  
  ✅ Auto-rebuild on template/content changes
  ✅ SPA routing support
  ✅ Development-friendly error handling

${chalk.yellow('Environment Variables:')}
  DEV_PORT        Server port (default: 3000)

${chalk.yellow('File Watching:')}
  The server watches these directories for changes:
  • templates/    - Template files
  • content/      - Blog content  
  • config/       - Configuration files
  • styles/       - Stylesheets
    `);
    process.exit(0);
  }

  // Handle custom port
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    process.env.DEV_PORT = args[portIndex + 1];
  }

  // Handle initial sync
  if (args.includes('--sync')) {
    await runSyncInDev();
  }

  // Start the development server
  const server = new DevServer();
  await server.start();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Dev server failed:'), error);
    process.exit(1);
  });
}

module.exports = DevServer; 