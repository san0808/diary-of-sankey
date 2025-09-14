#!/usr/bin/env node

const express = require('express');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');

class PreviewServer {
  constructor() {
    this.app = express();
    this.port = process.env.PREVIEW_PORT || 4000;
    this.publicDir = path.join(process.cwd(), 'public');
  }

  async start() {
    console.log(chalk.cyan.bold('\n🔍 Starting Preview Server\n'));

    // Check if build exists
    if (!await fs.pathExists(this.publicDir)) {
      console.error(chalk.red('❌ No build found. Run "npm run build" first.'));
      process.exit(1);
    }

    this.setupServer();
    await this.listen();
  }

  setupServer() {
    // Serve static files from public directory
    this.app.use(express.static(this.publicDir));

    // Handle SPA routing - serve index.html for non-file requests, 404 on misses
    this.app.get('*', (req, res) => {
      // If it's a file request (has extension), try to serve it
      if (path.extname(req.path)) {
        const notFoundPath = path.join(this.publicDir, '404.html');
        return fs.existsSync(notFoundPath)
          ? res.status(404).sendFile(notFoundPath)
          : res.status(404).send('File not found');
      }
      
      // For all other requests, serve index.html if path is a known directory; otherwise 404
      const indexPath = path.join(this.publicDir, 'index.html');
      const notFoundPath = path.join(this.publicDir, '404.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else if (fs.existsSync(notFoundPath)) {
        res.status(404).sendFile(notFoundPath);
      } else {
        res.status(404).send('Index file not found');
      }
    });
  }

  async listen() {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(chalk.green.bold(`\n🌐 Preview server running!\n`));
          console.log(chalk.cyan(`   Local:    http://localhost:${this.port}`));
          console.log(chalk.cyan(`   Network:  http://0.0.0.0:${this.port}`));
          console.log(chalk.gray(`\n   📁 Serving: ${this.publicDir}`));
          console.log(chalk.gray(`   📊 Production preview mode\n`));
          
          console.log(chalk.yellow('💡 This is a production preview:'));
          console.log('   • No file watching or live reload');
          console.log('   • Serves the built site from public/');
          console.log('   • Use "npm run dev" for development\n');
          
          resolve(server);
        }
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Shutting down preview server...'));
        server.close(() => {
          console.log(chalk.green('✅ Preview server stopped'));
          process.exit(0);
        });
      });
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
${chalk.cyan.bold('Preview Server')}

${chalk.yellow('Usage:')} npm run preview [options]

${chalk.yellow('Options:')}
  --help          Show this help message
  --port <port>   Set custom port (default: 4000)

${chalk.yellow('Description:')}
  Serves the built site from the public/ directory.
  This is useful for testing the production build locally.

${chalk.yellow('Environment Variables:')}
  PREVIEW_PORT    Server port (default: 4000)

${chalk.yellow('Prerequisites:')}
  Run "npm run build" before using the preview server.
    `);
    process.exit(0);
  }

  // Handle custom port
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    process.env.PREVIEW_PORT = args[portIndex + 1];
  }

  // Start the preview server
  const server = new PreviewServer();
  await server.start();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Preview server failed:'), error);
    process.exit(1);
  });
}

module.exports = PreviewServer; 