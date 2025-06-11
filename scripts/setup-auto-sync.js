#!/usr/bin/env node

const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');

console.log(chalk.blue.bold('\n🔄 Auto-Sync Setup for Notion Blog\n'));

const REQUIRED_SECRETS = [
  {
    name: 'NOTION_API_KEY',
    description: 'Your Notion integration API key',
    envVar: 'NOTION_API_KEY'
  },
  {
    name: 'NOTION_DATABASE_ID',
    description: 'Your Notion database ID',
    envVar: 'NOTION_DATABASE_ID'
  }
];

const OPTIONAL_SECRETS = [
  {
    name: 'SITE_URL',
    description: 'Your blog URL (e.g., https://yourblog.com)',
    envVar: 'SITE_URL'
  },
  {
    name: 'AUTHOR_NAME',
    description: 'Your name',
    envVar: 'AUTHOR_NAME'
  },
  {
    name: 'BLOG_TITLE',
    description: 'Your blog title',
    envVar: 'BLOG_TITLE'
  }
];

async function checkCurrentSetup() {
  console.log(chalk.yellow('📋 Checking current setup...\n'));
  
  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env');
  const hasEnvFile = await fs.pathExists(envPath);
  
  if (hasEnvFile) {
    console.log(chalk.green('✅ .env file found'));
    
    // Load environment variables
    require('dotenv').config();
    
    const missingSecrets = REQUIRED_SECRETS.filter(secret => !process.env[secret.envVar]);
    
    if (missingSecrets.length === 0) {
      console.log(chalk.green('✅ All required environment variables are set'));
    } else {
      console.log(chalk.red('❌ Missing required environment variables:'));
      missingSecrets.forEach(secret => {
        console.log(chalk.red(`   - ${secret.name}`));
      });
    }
  } else {
    console.log(chalk.red('❌ .env file not found'));
  }
  
  // Check if workflow file exists
  const workflowPath = path.join(process.cwd(), '.github/workflows/auto-sync.yml');
  const hasWorkflow = await fs.pathExists(workflowPath);
  
  if (hasWorkflow) {
    console.log(chalk.green('✅ Auto-sync workflow file created'));
  } else {
    console.log(chalk.red('❌ Auto-sync workflow file not found'));
  }
  
  console.log();
}

function printSecretsInstructions() {
  console.log(chalk.blue.bold('🔐 GitHub Repository Secrets Setup\n'));
  
  console.log(chalk.white('You need to add these secrets to your GitHub repository:\n'));
  
  console.log(chalk.yellow.bold('Required Secrets:'));
  REQUIRED_SECRETS.forEach(secret => {
    const currentValue = process.env[secret.envVar];
    console.log(chalk.white(`📝 ${chalk.bold(secret.name)}`));
    console.log(chalk.gray(`   ${secret.description}`));
    if (currentValue) {
      const masked = secret.name.includes('KEY') ? 
        currentValue.substring(0, 10) + '...' : 
        currentValue;
      console.log(chalk.green(`   Current value: ${masked}`));
    } else {
      console.log(chalk.red('   ❌ Not set in .env file'));
    }
    console.log();
  });
  
  console.log(chalk.yellow.bold('Optional Secrets (will use defaults if not set):'));
  OPTIONAL_SECRETS.forEach(secret => {
    const currentValue = process.env[secret.envVar];
    console.log(chalk.white(`📝 ${chalk.bold(secret.name)}`));
    console.log(chalk.gray(`   ${secret.description}`));
    if (currentValue) {
      console.log(chalk.green(`   Current value: ${currentValue}`));
    } else {
      console.log(chalk.gray('   Will use default value'));
    }
    console.log();
  });
}

function printSetupInstructions() {
  const repoUrl = 'https://github.com/YOUR_USERNAME/diary-of-sankey';
  
  console.log(chalk.blue.bold('📚 Setup Instructions:\n'));
  
  console.log(chalk.white.bold('1. Go to your GitHub repository settings:'));
  console.log(chalk.cyan(`   ${repoUrl}/settings/secrets/actions\n`));
  
  console.log(chalk.white.bold('2. Click "New repository secret" and add each secret:\n'));
  
  console.log(chalk.white.bold('3. Commit and push the auto-sync workflow:'));
  console.log(chalk.cyan('   git add .github/workflows/auto-sync.yml'));
  console.log(chalk.cyan('   git commit -m "Add auto-sync workflow"'));
  console.log(chalk.cyan('   git push\n'));
  
  console.log(chalk.white.bold('4. Test the setup:'));
  console.log(chalk.cyan('   Go to Actions tab → Auto Sync with Notion → Run workflow\n'));
  
  console.log(chalk.green.bold('🎉 Once set up, your blog will automatically sync every 3 hours!\n'));
}

function printScheduleInfo() {
  console.log(chalk.blue.bold('⏰ Auto-Sync Schedule:\n'));
  
  const hours = [];
  for (let i = 0; i < 24; i += 3) {
    hours.push(`${i.toString().padStart(2, '0')}:00`);
  }
  
  console.log(chalk.white('📅 Sync times (UTC):'));
  console.log(chalk.cyan(`   ${hours.join(', ')}\n`));
  
  console.log(chalk.white('🔧 Manual triggers:'));
  console.log(chalk.cyan('   • GitHub Actions → "Auto Sync with Notion" → "Run workflow"'));
  console.log(chalk.cyan('   • Local: npm run sync\n'));
  
  console.log(chalk.white('⚡ What happens during auto-sync:'));
  console.log(chalk.gray('   1. Connects to Notion API'));
  console.log(chalk.gray('   2. Fetches updated content'));
  console.log(chalk.gray('   3. Only commits if there are changes'));
  console.log(chalk.gray('   4. Triggers automatic deployment'));
  console.log();
}

async function main() {
  try {
    await checkCurrentSetup();
    
    const { showInstructions } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showInstructions',
        message: 'Would you like to see the setup instructions?',
        default: true
      }
    ]);
    
    if (showInstructions) {
      printSecretsInstructions();
      printSetupInstructions();
      printScheduleInfo();
      
      console.log(chalk.yellow.bold('💡 Pro Tips:\n'));
      console.log(chalk.white('• The auto-sync only runs on the main branch'));
      console.log(chalk.white('• Changes are committed with timestamps'));
      console.log(chalk.white('• Failed syncs will show in GitHub Actions logs'));
      console.log(chalk.white('• You can force sync all posts using "Run workflow" button\n'));
      
      console.log(chalk.green.bold('🚀 Happy auto-blogging!'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 