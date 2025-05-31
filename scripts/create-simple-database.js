#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const inquirer = require('inquirer');
const chalk = require('chalk');

/**
 * Simplified script to create a Notion database
 * This version uses an existing page as parent to avoid workspace permission issues
 */
async function createDatabase() {
  console.log(chalk.cyan.bold('\n🗄️ Simple Database Creator\n'));
  
  console.log(chalk.yellow('📋 Prerequisites:'));
  console.log('1. Create a page in Notion (e.g., "Blog System")');
  console.log('2. Share that page with your integration');
  console.log('3. Copy the page ID from the URL\n');
  
  try {
    // Get API key
    let apiKey = process.env.NOTION_API_KEY;
    
    if (!apiKey) {
      const { inputApiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'inputApiKey',
          message: 'Enter your Notion Integration Token:',
          mask: '*',
          validate: (input) => {
            if (!input.trim()) return 'API key is required';
            if (!input.startsWith('ntn_') && !input.startsWith('secret_')) {
              return 'Token should start with "ntn_" or "secret_"';
            }
            return true;
          }
        }
      ]);
      apiKey = inputApiKey;
    }

    const notion = new Client({ auth: apiKey });

    // Test connection
    await notion.users.me();
    console.log(chalk.green('✅ Connected to Notion successfully!'));

    // Get parent page ID
    const { parentPageId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'parentPageId',
        message: 'Enter the Page ID where you want to create the database:',
        validate: (input) => {
          if (!input.trim()) return 'Page ID is required';
          // Remove hyphens and check if it's 32 characters (UUID without hyphens)
          const cleanId = input.replace(/-/g, '');
          if (cleanId.length !== 32) return 'Page ID should be 32 characters (UUID format)';
          return true;
        },
        transformer: (input) => {
          // Format as UUID if needed
          const clean = input.replace(/-/g, '');
          if (clean.length === 32) {
            return `${clean.slice(0,8)}-${clean.slice(8,12)}-${clean.slice(12,16)}-${clean.slice(16,20)}-${clean.slice(20,32)}`;
          }
          return input;
        }
      }
    ]);

    // Format the page ID properly
    const formattedPageId = parentPageId.replace(/-/g, '');
    const properPageId = `${formattedPageId.slice(0,8)}-${formattedPageId.slice(8,12)}-${formattedPageId.slice(12,16)}-${formattedPageId.slice(16,20)}-${formattedPageId.slice(20,32)}`;

    // Test if we can access the page
    try {
      await notion.pages.retrieve({ page_id: properPageId });
      console.log(chalk.green('✅ Page found and accessible!'));
    } catch (error) {
      console.log(chalk.red('❌ Cannot access the page. Make sure:'));
      console.log('1. The page ID is correct');
      console.log('2. The page is shared with your integration');
      console.log('3. Your integration has the right permissions');
      throw new Error('Page not accessible');
    }

    // Create the database in the parent page
    console.log(chalk.yellow('🔨 Creating blog database...\n'));
    
    const database = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: properPageId
      },
      title: [
        {
          type: 'text',
          text: { content: 'Blog Posts' }
        }
      ],
      properties: {
        'Title': { title: {} },
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
              { name: 'Math', color: 'orange' }
            ]
          }
        },
        'Publish Date': { date: {} },
        'Tags': { multi_select: { options: [] } },
        'Slug': { rich_text: {} },
        'Excerpt': { rich_text: {} },
        'Featured Image': { files: {} },
        'Featured': { checkbox: {} }
      }
    });

    console.log(chalk.green('✅ Database created successfully!'));

    // Create sample post
    console.log(chalk.yellow('📝 Adding sample post...\n'));
    
    await notion.pages.create({
      parent: { type: 'database_id', database_id: database.id },
      properties: {
        'Title': {
          title: [{ text: { content: 'Welcome to Your Blog!' } }]
        },
        'Status': { select: { name: 'Draft' } },
        'Category': { select: { name: 'Blog' } },
        'Featured': { checkbox: true }
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '🎉 Congratulations! Your blog database is ready. Change this post status to "Published" to see it on your blog.'
                }
              }
            ]
          }
        }
      ]
    });

    console.log(chalk.green('✅ Sample post created!'));

    // Show results
    console.log(chalk.green.bold('\n🎉 Setup Complete!\n'));
    console.log(chalk.cyan('Database ID:'));
    console.log(chalk.yellow(database.id));
    console.log(chalk.cyan('\nDatabase URL:'));
    console.log(chalk.blue(`https://notion.so/${database.id.replace(/-/g, '')}`));
    
    console.log(chalk.cyan('\n🔑 Next Steps:'));
    console.log('1. Add this to your .env file:');
    console.log(chalk.yellow(`   NOTION_DATABASE_ID=${database.id}`));
    console.log('2. Run: npm run sync && npm run dev');
    console.log('3. Start writing blog posts in Notion!');

    return database.id;

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createDatabase()
    .then(databaseId => {
      console.log(chalk.green.bold('\n✨ All done! Happy blogging! 📝\n'));
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('Setup failed:'), error.message);
      process.exit(1);
    });
}

module.exports = createDatabase; 