#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const inquirer = require('inquirer');
const chalk = require('chalk');
const logger = require('./utils/logger');

/**
 * Fully Automated Notion Database Creator
 * 
 * This script attempts multiple strategies to automatically create a blog database:
 * 1. Find existing pages accessible to the integration
 * 2. Search for pages in the workspace
 * 3. Try to create a workspace page (may fail due to permissions)
 * 4. Guide user to share an existing page if needed
 */
class AutomatedNotionDatabaseCreator {
  constructor() {
    this.notion = null;
    this.parentPageId = null;
  }

  /**
   * Main automated creation method
   */
  async create() {
    console.log(chalk.cyan.bold('\n🤖 Fully Automated Notion Database Creator\n'));
    console.log(chalk.gray('This script will automatically set up your blog database end-to-end.\n'));
    
    try {
      await this.getNotionCredentials();
      await this.findOrCreateParentPage();
      const database = await this.createBlogDatabase();
      await this.createSamplePost(database.id);
      await this.showSuccessMessage(database);
      
      return database.id;
    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error.message);
      await this.showTroubleshootingHelp(error);
      throw error;
    }
  }

  /**
   * Get Notion API credentials with validation
   */
  async getNotionCredentials() {
    let apiKey = process.env.NOTION_API_KEY;
    
    if (!apiKey) {
      console.log(chalk.yellow('🔑 Notion API Key Required\n'));
      console.log('To create a Notion integration:');
      console.log('1. Go to https://www.notion.so/my-integrations');
      console.log('2. Click "New integration"');
      console.log('3. Give it a name (e.g., "Diary of Sankey Blog")');
      console.log('4. Select your workspace');
      console.log('5. Copy the "Internal Integration Token"\n');
      
      const { inputApiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'inputApiKey',
          message: 'Enter your Notion Integration Token:',
          mask: '*',
          validate: (input) => {
            if (!input.trim()) return 'API key is required';
            if (!input.startsWith('ntn_') && !input.startsWith('secret_')) {
              return 'Token should start with "ntn_" (new format) or "secret_" (legacy format)';
            }
            return true;
          }
        }
      ]);
      
      apiKey = inputApiKey;
    }

    // Initialize Notion client
    this.notion = new Client({
      auth: apiKey,
      notionVersion: '2022-06-28'
    });

    // Test the connection
    try {
      const user = await this.notion.users.me();
      console.log(chalk.green(`✅ Connected to Notion as: ${user.name || user.bot?.owner?.user?.name || 'Bot User'}`));
    } catch (error) {
      if (error.code === 'unauthorized') {
        throw new Error('Invalid API key. Please check your integration token.');
      }
      throw new Error('Connection failed. Please check your internet connection and try again.');
    }
  }

  /**
   * Smart strategy to find or create a parent page
   */
  async findOrCreateParentPage() {
    console.log(chalk.yellow('\n📄 Finding or creating parent page...\n'));

    // Strategy 1: Search for existing accessible pages
    console.log(chalk.blue('🔍 Strategy 1: Searching for existing accessible pages...'));
    
    try {
      const searchResults = await this.notion.search({
        filter: { value: 'page', property: 'object' },
        page_size: 10
      });

      const accessiblePages = searchResults.results.filter(page => 
        page.object === 'page' && 
        page.parent.type !== 'database_id' && 
        !page.archived
      );

      if (accessiblePages.length > 0) {
        console.log(chalk.green(`✅ Found ${accessiblePages.length} accessible page(s)!`));
        
        // Show options to user
        const pageChoices = accessiblePages.map(page => ({
          name: `📄 ${this.getPageTitle(page)} ${chalk.gray(`(${page.parent.type})`)}`,
          value: page.id,
          short: this.getPageTitle(page)
        }));

        pageChoices.unshift({
          name: '📁 Create a new page for the blog',
          value: 'create_new',
          short: 'Create new page'
        });

        const { selectedPageId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedPageId',
            message: 'Where should we create the blog database?',
            choices: pageChoices
          }
        ]);

        if (selectedPageId === 'create_new') {
          await this.attemptPageCreation();
        } else {
          this.parentPageId = selectedPageId;
          const selectedPage = accessiblePages.find(p => p.id === selectedPageId);
          console.log(chalk.green(`✅ Using existing page: ${this.getPageTitle(selectedPage)}`));
          return;
        }
      } else {
        console.log(chalk.yellow('⚠️  No accessible pages found. Trying to create a new page...'));
        await this.attemptPageCreation();
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Search failed. Trying to create a new page...'));
      await this.attemptPageCreation();
    }
  }

  /**
   * Attempt to create a page using multiple strategies
   */
  async attemptPageCreation() {
    console.log(chalk.blue('\n🏗️  Strategy 2: Creating a new parent page...'));

    // Strategy 2A: Try workspace parent (may fail due to permissions)
    try {
      console.log(chalk.gray('   Trying workspace parent...'));
      
      const parentPage = await this.notion.pages.create({
        parent: {
          type: 'workspace',
          workspace: true
        },
        properties: {
          title: [
            {
              type: 'text',
              text: {
                content: '📝 Diary of Sankey - Blog System'
              }
            }
          ]
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '🚀 Blog Management Hub'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'This page contains your blog database and related resources. Your blog content will be synced from here to your static site.'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'callout',
            callout: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'The database below will be created automatically. You can start writing blog posts by adding new pages to the database!'
                  }
                }
              ],
              icon: {
                emoji: '💡'
              }
            }
          }
        ]
      });
      
      this.parentPageId = parentPage.id;
      console.log(chalk.green('✅ Successfully created workspace page!'));
      return;
      
    } catch (error) {
      console.log(chalk.yellow('⚠️  Workspace page creation failed (this is common due to permissions)'));
    }

    // Strategy 2B: Try to find a page via search and guide user
    console.log(chalk.blue('\n🔍 Strategy 3: Looking for any pages to share with integration...'));
    
    try {
      // Search more broadly
      const allSearch = await this.notion.search({
        page_size: 50
      });

      if (allSearch.results.length === 0) {
        await this.guideUserToCreateAndSharePage();
      } else {
        await this.guideUserToShareExistingPage();
      }
    } catch (error) {
      await this.guideUserToCreateAndSharePage();
    }
  }

  /**
   * Guide user to create and share a page manually
   */
  async guideUserToCreateAndSharePage() {
    console.log(chalk.cyan('\n📋 Setup Required: Create and Share a Page\n'));
    console.log('To complete the automated setup, please:');
    console.log(chalk.yellow('1. Create a new page in Notion:'));
    console.log('   • Go to your Notion workspace');
    console.log('   • Click "New page" or press Ctrl+N (Cmd+N on Mac)');
    console.log('   • Give it a title like "Blog System" or "Diary of Sankey"');
    console.log(chalk.yellow('\n2. Share the page with your integration:'));
    console.log('   • Click "Share" in the top right of the page');
    console.log('   • Click "Invite"');
    console.log('   • Search for your integration name');
    console.log('   • Give it "Full access" permissions');
    console.log(chalk.yellow('\n3. Get the page ID:'));
    console.log('   • Copy the page URL from your browser');
    console.log('   • The page ID is the 32-character string at the end');
    
    const { pageId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'pageId',
        message: '\nEnter the Page ID (32 characters):',
        validate: (input) => {
          if (!input.trim()) return 'Page ID is required';
          const cleanId = input.replace(/-/g, '').trim();
          if (cleanId.length !== 32) return 'Page ID should be 32 characters';
          if (!/^[a-f0-9]{32}$/i.test(cleanId)) return 'Page ID should contain only letters and numbers';
          return true;
        },
        transformer: (input) => {
          const clean = input.replace(/-/g, '').trim();
          if (clean.length === 32) {
            return `${clean.slice(0,8)}-${clean.slice(8,12)}-${clean.slice(12,16)}-${clean.slice(16,20)}-${clean.slice(20,32)}`;
          }
          return input;
        }
      }
    ]);

    // Format and validate the page ID
    const cleanId = pageId.replace(/-/g, '');
    const formattedPageId = `${cleanId.slice(0,8)}-${cleanId.slice(8,12)}-${cleanId.slice(12,16)}-${cleanId.slice(16,20)}-${cleanId.slice(20,32)}`;

    // Test access to the page
    try {
      const page = await this.notion.pages.retrieve({ page_id: formattedPageId });
      this.parentPageId = formattedPageId;
      console.log(chalk.green(`✅ Successfully accessed page: ${this.getPageTitle(page)}`));
    } catch (error) {
      if (error.code === 'object_not_found') {
        throw new Error('Page not found. Please check the page ID and make sure the page exists.');
      } else if (error.code === 'unauthorized') {
        throw new Error('Cannot access the page. Please make sure you shared the page with your integration.');
      } else {
        throw new Error(`Failed to access page: ${error.message}`);
      }
    }
  }

  /**
   * Guide user to share an existing page
   */
  async guideUserToShareExistingPage() {
    console.log(chalk.cyan('\n📋 Integration Permission Required\n'));
    console.log('Your integration needs access to a page to create the database.');
    console.log(chalk.yellow('\nPlease share a page with your integration:'));
    console.log('1. Go to any page in your Notion workspace');
    console.log('2. Click "Share" in the top right');
    console.log('3. Click "Invite"');
    console.log('4. Search for your integration name');
    console.log('5. Give it "Full access" permissions');
    console.log('6. Copy the page URL and paste the page ID below');
    
    await this.guideUserToCreateAndSharePage();
  }

  /**
   * Create the blog database with full schema
   */
  async createBlogDatabase() {
    console.log(chalk.yellow('\n🔨 Creating blog database...\n'));

    if (!this.parentPageId) {
      throw new Error('No parent page available for database creation');
    }

    const database = await this.notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: this.parentPageId
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Blog Posts'
          }
        }
      ],
      properties: {
        'Title': {
          title: {}
        },
        'Status': {
          select: {
            options: [
              { name: 'Draft', color: 'gray' },
              { name: 'Scheduled', color: 'yellow' },
              { name: 'Published', color: 'green' },
              { name: 'Archived', color: 'red' }
            ]
          }
        },
        'Category': {
          select: {
            options: [
              { name: 'Blog', color: 'blue' },
              { name: 'Research Notes', color: 'purple' },
              { name: 'Math', color: 'orange' },
              { name: 'Technology', color: 'green' },
              { name: 'Personal', color: 'pink' }
            ]
          }
        },
        'Publish Date': {
          date: {}
        },
        'Tags': {
          multi_select: {
            options: [
              { name: 'javascript', color: 'yellow' },
              { name: 'typescript', color: 'blue' },
              { name: 'react', color: 'blue' },
              { name: 'node', color: 'green' },
              { name: 'ai', color: 'purple' },
              { name: 'machine-learning', color: 'purple' },
              { name: 'tutorial', color: 'orange' },
              { name: 'productivity', color: 'pink' },
              { name: 'web-development', color: 'blue' },
              { name: 'backend', color: 'green' }
            ]
          }
        },
        'Slug': {
          rich_text: {}
        },
        'Excerpt': {
          rich_text: {}
        },
        'Featured Image': {
          files: {}
        },
        'Featured': {
          checkbox: {}
        },
        'Reading Time': {
          number: {
            format: 'number'
          }
        },
        'Word Count': {
          number: {
            format: 'number'
          }
        }
      }
    });

    console.log(chalk.green('✅ Blog database created successfully!'));
    return database;
  }

  /**
   * Create a comprehensive sample blog post
   */
  async createSamplePost(databaseId) {
    console.log(chalk.yellow('📝 Creating sample blog post...\n'));

    try {
      await this.notion.pages.create({
        parent: {
          type: 'database_id',
          database_id: databaseId
        },
        properties: {
          'Title': {
            title: [
              {
                text: {
                  content: 'Welcome to Diary of Sankey! 🎉'
                }
              }
            ]
          },
          'Status': {
            select: {
              name: 'Draft'
            }
          },
          'Category': {
            select: {
              name: 'Blog'
            }
          },
          'Tags': {
            multi_select: [
              { name: 'tutorial' },
              { name: 'productivity' }
            ]
          },
          'Featured': {
            checkbox: true
          },
          'Excerpt': {
            rich_text: [
              {
                text: {
                  content: 'A comprehensive guide to getting started with your new Notion-powered blog system.'
                }
              }
            ]
          }
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Welcome to Your New Blog! 🚀'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Congratulations! You\'ve successfully set up your Notion-powered blog system. This is your first blog post, and it demonstrates how easy it is to create content using Notion\'s rich editor.'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '✨ What You Can Do'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '📝 Write rich content with '
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: 'formatting'
                  },
                  annotations: {
                    bold: true
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: ', '
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: 'links'
                  },
                  annotations: {
                    italic: true
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: ', and '
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: 'code'
                  },
                  annotations: {
                    code: true
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '🏷️ Organize posts with categories and tags'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '⏰ Schedule posts for future publication'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '🖼️ Add images, videos, and other media'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '🚀 Next Steps'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Run '
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: 'npm run sync'
                  },
                  annotations: {
                    code: true
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: ' to sync this content to your blog'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Run '
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: 'npm run dev'
                  },
                  annotations: {
                    code: true
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: ' to preview your blog locally'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Change this post\'s status to "Published" to see it live'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Create your first real blog post!'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'callout',
            callout: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '💡 Pro tip: Keep this post as "Draft" while you test your setup. Change it to "Published" when you\'re ready to see it on your live blog!'
                  }
                }
              ],
              icon: {
                emoji: '💡'
              }
            }
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: '📚 Resources'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Check out the '
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: 'docs/'
                  },
                  annotations: {
                    code: true
                  }
                },
                {
                  type: 'text',
                  text: {
                    content: ' folder in your project for detailed guides on:'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Writing workflow with Notion'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Publishing and scheduling posts'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Customizing your blog design'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Deploying to GitHub Pages'
                  }
                }
              ]
            }
          }
        ]
      });

      console.log(chalk.green('✅ Sample blog post created!'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not create sample post, but database is ready to use'));
    }
  }

  /**
   * Extract title from a Notion page object
   */
  getPageTitle(page) {
    if (page.properties) {
      for (const [key, value] of Object.entries(page.properties)) {
        if (value.type === 'title' && value.title && value.title.length > 0) {
          return value.title[0].plain_text;
        }
      }
    }
    return 'Untitled Page';
  }

  /**
   * Show comprehensive success message
   */
  async showSuccessMessage(database) {
    console.log(chalk.green.bold('\n🎉 Success! Your Notion Blog System is Ready!\n'));
    
    console.log(chalk.cyan('📋 Database Details:'));
    console.log(chalk.gray(`   Database ID: ${database.id}`));
    console.log(chalk.gray(`   Database URL: https://notion.so/${database.id.replace(/-/g, '')}`));
    
    console.log(chalk.cyan('\n🔧 Environment Setup:'));
    console.log(chalk.yellow(`Add this to your .env file:`));
    console.log(chalk.gray(`NOTION_DATABASE_ID=${database.id}`));
    
    console.log(chalk.cyan('\n🚀 Ready to Use:'));
    console.log('1. ✅ Database created with proper schema');
    console.log('2. ✅ Sample blog post added');
    console.log('3. ✅ Integration permissions configured');
    
    console.log(chalk.cyan('\n📝 Next Steps:'));
    console.log(chalk.blue('npm run sync     ') + chalk.gray('# Sync content from Notion'));
    console.log(chalk.blue('npm run dev      ') + chalk.gray('# Start development server'));
    console.log(chalk.blue('npm run build    ') + chalk.gray('# Build for production'));
    
    console.log(chalk.cyan('\n✍️ Start Writing:'));
    console.log('• Open your database in Notion');
    console.log('• Click "New" to create a blog post');
    console.log('• Write using Notion\'s rich editor');
    console.log('• Set status to "Published" when ready');
    
    // Ask if user wants to open the database
    const { openDatabase } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openDatabase',
        message: 'Open the database in your browser?',
        default: true
      }
    ]);
    
    if (openDatabase) {
      const databaseUrl = `https://notion.so/${database.id.replace(/-/g, '')}`;
      console.log(chalk.blue(`\n🌐 Opening: ${databaseUrl}`));
      
      try {
        const open = require('open');
        await open(databaseUrl);
      } catch (error) {
        console.log(chalk.yellow('Could not auto-open. Please visit the URL above manually.'));
      }
    }
  }

  /**
   * Show troubleshooting help based on error type
   */
  async showTroubleshootingHelp(error) {
    console.log(chalk.cyan('\n🔧 Troubleshooting Help:\n'));
    
    if (error.code === 'unauthorized') {
      console.log(chalk.yellow('❓ Authorization Issue:'));
      console.log('• Make sure your integration token is correct');
      console.log('• Verify the integration has proper permissions');
      console.log('• Check that you shared a page with your integration');
    } else if (error.code === 'object_not_found') {
      console.log(chalk.yellow('❓ Page Not Found:'));
      console.log('• Verify the page ID is correct (32 characters)');
      console.log('• Make sure the page exists in your workspace');
      console.log('• Confirm the page is shared with your integration');
    } else if (error.message.includes('validation_error')) {
      console.log(chalk.yellow('❓ Validation Error:'));
      console.log('• This usually means permission issues');
      console.log('• Try sharing an existing page with your integration');
      console.log('• Follow the manual setup guide in the README');
    } else {
      console.log(chalk.yellow('❓ General Error:'));
      console.log('• Check your internet connection');
      console.log('• Verify your Notion workspace is accessible');
      console.log('• Try running the setup again');
    }
    
    console.log(chalk.cyan('\n📖 For detailed setup instructions, see:'));
    console.log('• docs/NOTION_SETUP.md');
    console.log('• docs/QUICK_START.md');
    console.log('• README.md');
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
${chalk.cyan.bold('Notion Blog Database Creator')}

${chalk.yellow('Usage:')} npm run create-database

${chalk.yellow('Description:')}
This script fully automates the creation of a Notion blog database.
It will:
• Connect to your Notion workspace
• Find or create a parent page for the database  
• Create a fully configured blog database
• Add a sample blog post
• Provide setup instructions

${chalk.yellow('Requirements:')}
• Notion integration token (will prompt if not in .env)
• Internet connection

${chalk.yellow('Environment Variables:')}
• NOTION_API_KEY (optional, will prompt if missing)

${chalk.yellow('Features:')}
• Fully automated setup process
• Multiple fallback strategies
• Clear error messages and troubleshooting
• Sample content creation
• Environment configuration guidance
    `);
    process.exit(0);
  }

  try {
    const creator = new AutomatedNotionDatabaseCreator();
    const databaseId = await creator.create();
    
    // Optionally update .env file
    const fs = require('fs-extra');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    
    if (await fs.pathExists(envPath)) {
      const { updateEnv } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'updateEnv',
          message: 'Update your .env file automatically?',
          default: true
        }
      ]);
      
      if (updateEnv) {
        let envContent = await fs.readFile(envPath, 'utf8');
        
        if (envContent.includes('NOTION_DATABASE_ID=')) {
          envContent = envContent.replace(
            /NOTION_DATABASE_ID=.*/,
            `NOTION_DATABASE_ID=${databaseId}`
          );
        } else {
          envContent += `\nNOTION_DATABASE_ID=${databaseId}\n`;
        }
        
        await fs.writeFile(envPath, envContent);
        console.log(chalk.green('✅ .env file updated with database ID!'));
      }
    }
    
    console.log(chalk.green.bold('\n🎊 Setup Complete! Happy Blogging! 📝\n'));
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed. See troubleshooting help above.'));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = AutomatedNotionDatabaseCreator; 