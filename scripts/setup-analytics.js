#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

class AnalyticsSetup {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
    this.currentEnv = this.loadCurrentEnv();
  }

  loadCurrentEnv() {
    if (!fs.existsSync(this.envPath)) {
      console.log(chalk.yellow('⚠️  No .env file found. Please run `npm run setup` first.'));
      process.exit(1);
    }

    const envContent = fs.readFileSync(this.envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return env;
  }

  async run() {
    console.log(chalk.blue.bold('\n📊 Analytics Setup for Diary of Sankey\n'));
    
    console.log(chalk.gray('Configure analytics tracking for your blog. You can enable multiple providers.\n'));

    const answers = await this.gatherAnalyticsPreferences();
    await this.updateEnvironmentFile(answers);
    await this.showSetupInstructions(answers);
    
    console.log(chalk.green.bold('\n✅ Analytics setup complete!'));
    console.log(chalk.gray('Run `npm run build` to apply changes.\n'));
  }

  async gatherAnalyticsPreferences() {
    const questions = [
      {
        type: 'checkbox',
        name: 'providers',
        message: 'Which analytics providers would you like to enable?',
        choices: [
          {
            name: 'Google Analytics 4 (Most popular, detailed insights)',
            value: 'google',
            checked: !!this.currentEnv.GOOGLE_ANALYTICS_ID
          },
          {
            name: 'Vercel Analytics (Built-in with Vercel hosting, privacy-focused)',
            value: 'vercel',
            checked: this.currentEnv.ENABLE_VERCEL_ANALYTICS !== 'false'
          },
          {
            name: 'Plausible Analytics (Privacy-focused, GDPR compliant)',
            value: 'plausible',
            checked: this.currentEnv.ENABLE_PLAUSIBLE === 'true'
          },
          {
            name: 'Simple Analytics (Privacy-focused, lightweight)',
            value: 'simple',
            checked: this.currentEnv.ENABLE_SIMPLE_ANALYTICS === 'true'
          }
        ]
      }
    ];

    const { providers } = await inquirer.prompt(questions);
    const config = { providers };

    // Gather provider-specific configuration
    if (providers.includes('google')) {
      const googleConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'googleAnalyticsId',
          message: 'Enter your Google Analytics 4 Measurement ID (G-XXXXXXXXXX):',
          default: this.currentEnv.GOOGLE_ANALYTICS_ID || '',
          validate: (input) => {
            if (!input) return 'Google Analytics ID is required';
            if (!input.match(/^G-[A-Z0-9]+$/)) {
              return 'Format should be G-XXXXXXXXXX (e.g., G-1234567890)';
            }
            return true;
          }
        }
      ]);
      config.googleAnalyticsId = googleConfig.googleAnalyticsId;
    }

    if (providers.includes('plausible')) {
      const plausibleConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'plausibleDomain',
          message: 'Enter your domain for Plausible Analytics:',
          default: this.currentEnv.PLAUSIBLE_DOMAIN || this.currentEnv.SITE_URL?.replace('https://', '').replace('http://', '') || '',
          validate: (input) => {
            if (!input) return 'Domain is required for Plausible Analytics';
            return true;
          }
        }
      ]);
      config.plausibleDomain = plausibleConfig.plausibleDomain;
    }

    return config;
  }

  async updateEnvironmentFile(config) {
    let envContent = fs.readFileSync(this.envPath, 'utf8');

    // Update Google Analytics
    if (config.providers.includes('google')) {
      envContent = this.updateEnvVar(envContent, 'GOOGLE_ANALYTICS_ID', config.googleAnalyticsId);
    } else {
      envContent = this.updateEnvVar(envContent, 'GOOGLE_ANALYTICS_ID', '');
    }

    // Update Plausible Analytics
    if (config.providers.includes('plausible')) {
      envContent = this.updateEnvVar(envContent, 'ENABLE_PLAUSIBLE', 'true');
      envContent = this.updateEnvVar(envContent, 'PLAUSIBLE_DOMAIN', config.plausibleDomain);
    } else {
      envContent = this.updateEnvVar(envContent, 'ENABLE_PLAUSIBLE', 'false');
    }

    // Update Vercel Analytics
    envContent = this.updateEnvVar(envContent, 'ENABLE_VERCEL_ANALYTICS', 
      config.providers.includes('vercel') ? 'true' : 'false');

    // Update Simple Analytics
    envContent = this.updateEnvVar(envContent, 'ENABLE_SIMPLE_ANALYTICS', 
      config.providers.includes('simple') ? 'true' : 'false');

    // Add missing environment variables if they don't exist
    const requiredVars = [
      'ENABLE_PLAUSIBLE=false',
      'PLAUSIBLE_DOMAIN=',
      'ENABLE_VERCEL_ANALYTICS=true',
      'ENABLE_SIMPLE_ANALYTICS=false',
      'ENABLE_CUSTOM_ANALYTICS=false',
      'CUSTOM_ANALYTICS_CODE='
    ];

    requiredVars.forEach(varLine => {
      const [key] = varLine.split('=');
      if (!envContent.includes(key + '=')) {
        // Find the analytics section and add the variable
        const analyticsIndex = envContent.indexOf('# Optional: Analytics');
        if (analyticsIndex !== -1) {
          const nextSectionIndex = envContent.indexOf('\n# ', analyticsIndex + 1);
          const insertIndex = nextSectionIndex !== -1 ? nextSectionIndex : envContent.length;
          envContent = envContent.slice(0, insertIndex) + '\n' + varLine + envContent.slice(insertIndex);
        } else {
          envContent += '\n' + varLine;
        }
      }
    });

    fs.writeFileSync(this.envPath, envContent);
    console.log(chalk.green('✅ Environment file updated'));
  }

  updateEnvVar(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    } else {
      return content + `\n${key}=${value}`;
    }
  }

  async showSetupInstructions(config) {
    console.log(chalk.blue.bold('\n📋 Setup Instructions:\n'));

    if (config.providers.includes('google')) {
      console.log(chalk.yellow('🔍 Google Analytics 4:'));
      console.log('1. Go to https://analytics.google.com/');
      console.log('2. Create a new property or use existing one');
      console.log('3. Get your Measurement ID (G-XXXXXXXXXX)');
      console.log(`4. Your ID: ${chalk.green(config.googleAnalyticsId)}`);
      console.log('');
    }

    if (config.providers.includes('vercel')) {
      console.log(chalk.yellow('📊 Vercel Analytics:'));
      console.log('1. Go to your Vercel dashboard');
      console.log('2. Select your project');
      console.log('3. Go to Settings → Analytics');
      console.log('4. Enable Analytics (automatically configured)');
      console.log('');
    }

    if (config.providers.includes('plausible')) {
      console.log(chalk.yellow('🔒 Plausible Analytics:'));
      console.log('1. Go to https://plausible.io/');
      console.log('2. Create an account and add your site');
      console.log(`3. Your domain: ${chalk.green(config.plausibleDomain)}`);
      console.log('4. Privacy-focused, GDPR compliant analytics');
      console.log('');
    }

    if (config.providers.includes('simple')) {
      console.log(chalk.yellow('📈 Simple Analytics:'));
      console.log('1. Go to https://simpleanalytics.com/');
      console.log('2. Create an account and add your site');
      console.log('3. Lightweight, privacy-focused analytics');
      console.log('');
    }

    console.log(chalk.blue('🚀 Next Steps:'));
    console.log('1. Run `npm run build` to rebuild your site with analytics');
    console.log('2. Deploy your site to see analytics in action');
    console.log('3. Check your analytics dashboards after deployment');
  }
}

// Run the setup if called directly
if (require.main === module) {
  const setup = new AnalyticsSetup();
  setup.run().catch(console.error);
}

module.exports = AnalyticsSetup; 