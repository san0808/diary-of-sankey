#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Interactive setup script for Diary of Sankey blog system
 */
class SetupWizard {
  constructor() {
    this.config = {};
    this.envPath = path.join(process.cwd(), '.env');
  }

  /**
   * Main setup method
   */
  async run() {
    console.log(chalk.cyan.bold('\n🚀 Welcome to Diary of Sankey Setup Wizard!\n'));
    
    try {
      await this.gatherBasicInfo();
      await this.gatherNotionInfo();
      await this.gatherOptionalSettings();
      await this.createEnvFile();
      await this.createDirectories();
      await this.showCompletionInstructions();
      
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Gather basic blog information
   */
  async gatherBasicInfo() {
    console.log(chalk.yellow('📝 Basic Blog Information\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'authorName',
        message: 'What is your name?',
        default: 'Sanket Bhat',
        validate: (input) => input.trim().length > 0 || 'Name is required'
      },
      {
        type: 'input',
        name: 'blogTitle',
        message: 'What is your blog title?',
        default: 'Diary of Sankey',
        validate: (input) => input.trim().length > 0 || 'Blog title is required'
      },
      {
        type: 'input',
        name: 'siteUrl',
        message: 'What is your site URL? (without trailing slash)',
        default: 'https://diaryofsankey.com',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'authorBio',
        message: 'Write a short bio about yourself:',
        default: 'Engineer, learner, and occasional writer'
      }
    ]);
    
    Object.assign(this.config, answers);
  }

  /**
   * Gather Notion configuration
   */
  async gatherNotionInfo() {
    console.log(chalk.yellow('\n📚 Notion Integration\n'));
    
    console.log(chalk.blue('To set up Notion integration, you need to:'));
    console.log('1. Create a Notion integration at https://www.notion.so/my-integrations');
    console.log('2. Copy the "Internal Integration Token" (starts with "ntn_" for new integrations)');
    console.log('3. Create a database with the required properties');
    console.log('4. Share the database with your integration\n');
    
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'notionApiKey',
        message: 'Enter your Notion Integration Token:',
        mask: '*',
        validate: (input) => {
          if (!input.trim()) return 'Notion API key is required';
          if (!input.startsWith('ntn_') && !input.startsWith('secret_')) {
            return 'Token should start with "ntn_" (new format) or "secret_" (legacy format)';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'databaseOption',
        message: 'How would you like to set up your blog database?',
        choices: [
          {
            name: '🔧 Create database automatically (Recommended)',
            value: 'auto',
            short: 'Auto-create'
          },
          {
            name: '📝 I already have a database (Enter ID manually)',
            value: 'manual',
            short: 'Manual'
          }
        ],
        default: 'auto'
      }
    ]);
    
    Object.assign(this.config, answers);
    
    // Handle database setup
    if (answers.databaseOption === 'auto') {
      await this.createNotionDatabase(answers.notionApiKey);
    } else {
      await this.getExistingDatabaseId();
    }
    
    // Test Notion connection
    console.log(chalk.blue('\n🔍 Testing Notion connection...'));
    
    try {
      const NotionClient = require('./utils/notion-client');
      const client = new NotionClient({
        apiKey: this.config.notionApiKey,
        databaseId: this.config.notionDatabaseId
      });
      
      const success = await client.testConnection();
      if (success) {
        console.log(chalk.green('✅ Notion connection successful!'));
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      console.log(chalk.red('❌ Notion connection failed:'), error.message);
      console.log(chalk.yellow('You can continue setup and fix this later.\n'));
    }
  }

  /**
   * Create Notion database automatically
   */
  async createNotionDatabase(apiKey) {
    console.log(chalk.yellow('\n🤖 Creating your blog database automatically...\n'));
    
    try {
      // Set the API key temporarily
      process.env.NOTION_API_KEY = apiKey;
      
      const NotionDatabaseCreator = require('./create-notion-database');
      const creator = new NotionDatabaseCreator();
      const databaseId = await creator.create();
      
      this.config.notionDatabaseId = databaseId;
      console.log(chalk.green('✅ Database created and configured automatically!'));
      
    } catch (error) {
      console.log(chalk.red('❌ Failed to create database automatically:'), error.message);
      console.log(chalk.yellow('Falling back to manual database ID entry...\n'));
      await this.getExistingDatabaseId();
    }
  }

  /**
   * Get existing database ID manually
   */
  async getExistingDatabaseId() {
    const { notionDatabaseId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'notionDatabaseId',
        message: 'Enter your Notion Database ID:',
        validate: (input) => {
          if (!input.trim()) return 'Database ID is required';
          if (input.length !== 32) return 'Database ID should be 32 characters long';
          return true;
        }
      }
    ]);
    
    this.config.notionDatabaseId = notionDatabaseId;
  }

  /**
   * Gather social media and optional settings
   */
  async gatherOptionalSettings() {
    console.log(chalk.yellow('\n🔗 Social Media & Optional Settings\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'authorTwitter',
        message: 'Twitter handle (optional):',
        default: 'SanketBhat11',
        filter: (input) => input.startsWith('@') ? input : input ? `@${input}` : ''
      },
      {
        type: 'input',
        name: 'authorGithub',
        message: 'GitHub username (optional):',
        default: 'san0808'
      },
      {
        type: 'input',
        name: 'authorLinkedin',
        message: 'LinkedIn username (optional):',
        default: 'sanket-bhat-286a1a1b7'
      },
      {
        type: 'input',
        name: 'googleAnalyticsId',
        message: 'Google Analytics ID (optional):',
        validate: (input) => {
          if (!input) return true;
          return input.match(/^G-[A-Z0-9]+$/) || 'Format should be G-XXXXXXXXXX';
        }
      },
      {
        type: 'list',
        name: 'deployTarget',
        message: 'Where do you want to deploy?',
        choices: [
          { name: 'GitHub Pages', value: 'github-pages' },
          { name: 'Netlify', value: 'netlify' },
          { name: 'Manual/Other', value: 'manual' }
        ],
        default: 'github-pages'
      }
    ]);
    
    Object.assign(this.config, answers);
    
    // Gather deployment-specific settings
    if (answers.deployTarget === 'netlify') {
      const netlifyAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'netlifyAuthToken',
          message: 'Netlify Auth Token (optional, for CI/CD):',
          mask: '*'
        },
        {
          type: 'input',
          name: 'netlifySiteId',
          message: 'Netlify Site ID (optional, for CI/CD):'
        }
      ]);
      
      Object.assign(this.config, netlifyAnswers);
    }
  }

  /**
   * Create .env file with configuration
   */
  async createEnvFile() {
    console.log(chalk.yellow('\n📁 Creating configuration file...\n'));
    
    const envContent = this.generateEnvContent();
    
    // Check if .env already exists
    if (await fs.pathExists(this.envPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: '.env file already exists. Overwrite?',
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Skipping .env file creation.'));
        return;
      }
    }
    
    await fs.writeFile(this.envPath, envContent);
    console.log(chalk.green('✅ .env file created successfully!'));
  }

  /**
   * Generate .env file content
   */
  generateEnvContent() {
    return `# Notion Integration (Required)
NOTION_API_KEY=${this.config.notionApiKey}
NOTION_DATABASE_ID=${this.config.notionDatabaseId}

# Site Configuration (Required)
SITE_URL=${this.config.siteUrl}
AUTHOR_NAME=${this.config.authorName}
BLOG_TITLE=${this.config.blogTitle}
AUTHOR_BIO=${this.config.authorBio}
AUTHOR_TWITTER=${this.config.authorTwitter || ''}
AUTHOR_GITHUB=${this.config.authorGithub || ''}
AUTHOR_LINKEDIN=${this.config.authorLinkedin || ''}

# Build Configuration
NODE_ENV=production
BUILD_DIR=dist
CONTENT_DIR=content

# Optional: Analytics
GOOGLE_ANALYTICS_ID=${this.config.googleAnalyticsId || ''}

# Optional: Performance
ENABLE_IMAGE_OPTIMIZATION=true
ENABLE_LAZY_LOADING=true
ENABLE_SERVICE_WORKER=false

# Optional: Development
DEBUG=false
HOT_RELOAD=true
DEV_PORT=3000
PREVIEW_PORT=3001

# Optional: Deployment
${this.config.netlifyAuthToken ? `NETLIFY_AUTH_TOKEN=${this.config.netlifyAuthToken}` : '# NETLIFY_AUTH_TOKEN=your_netlify_token'}
${this.config.netlifySiteId ? `NETLIFY_SITE_ID=${this.config.netlifySiteId}` : '# NETLIFY_SITE_ID=your_netlify_site_id'}
DEPLOY_BRANCH=main

# Optional: Content Settings
POSTS_PER_PAGE=10
ENABLE_COMMENTS=false
ENABLE_SEARCH=true
ENABLE_RSS=true
ENABLE_SITEMAP=true
`;
  }

  /**
   * Create necessary directories
   */
  async createDirectories() {
    console.log(chalk.yellow('\n📂 Creating directories...\n'));
    
    const directories = [
      'content',
      'content/posts',
      'content/categories',
      'dist',
      'src/static',
      'logs'
    ];
    
    for (const dir of directories) {
      await fs.ensureDir(dir);
      console.log(chalk.green(`✅ Created: ${dir}`));
    }
  }

  /**
   * Show completion instructions
   */
  async showCompletionInstructions() {
    console.log(chalk.green.bold('\n🎉 Setup completed successfully!\n'));
    
    console.log(chalk.cyan('Next steps:'));
    console.log('1. Create your Notion database with these properties:');
    console.log(chalk.gray('   - Title (Title)'));
    console.log(chalk.gray('   - Status (Select: Draft, Scheduled, Published, Archived)'));
    console.log(chalk.gray('   - Category (Select: Blog, Research Notes, Math)'));
    console.log(chalk.gray('   - Publish Date (Date)'));
    console.log(chalk.gray('   - Tags (Multi-select)'));
    console.log(chalk.gray('   - Slug (Rich text, optional)'));
    console.log(chalk.gray('   - Excerpt (Rich text, optional)'));
    console.log(chalk.gray('   - Featured Image (Files, optional)'));
    console.log(chalk.gray('   - Featured (Checkbox, optional)\n'));
    
    console.log('2. Share your database with your Notion integration\n');
    
    console.log('3. Try these commands:');
    console.log(chalk.blue('   npm run sync    '), '# Sync content from Notion');
    console.log(chalk.blue('   npm run build   '), '# Build the static site');
    console.log(chalk.blue('   npm run dev     '), '# Start development server');
    console.log(chalk.blue('   npm test        '), '# Run tests\n');
    
    if (this.config.deployTarget === 'github-pages') {
      console.log('4. Set up GitHub repository secrets:');
      console.log(chalk.gray('   - NOTION_API_KEY'));
      console.log(chalk.gray('   - NOTION_DATABASE_ID\n'));
      
      console.log('5. Enable GitHub Pages in repository settings\n');
    } else if (this.config.deployTarget === 'netlify') {
      console.log('4. Connect your repository to Netlify');
      console.log('5. Set environment variables in Netlify dashboard\n');
    }
    
    console.log(chalk.magenta('📚 Documentation: README.md'));
    console.log(chalk.magenta('🐛 Issues: GitHub Issues'));
    console.log(chalk.magenta('💬 Discussions: GitHub Discussions\n'));
    
    console.log(chalk.green.bold('Happy blogging! 📝\n'));
  }
}

/**
 * Run setup wizard
 */
async function main() {
  const wizard = new SetupWizard();
  await wizard.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Setup failed:'), error);
    process.exit(1);
  });
}

module.exports = SetupWizard; 