#!/usr/bin/env node

const chalk = require('chalk');

console.log(chalk.blue.bold('\n📊 Quick Analytics Setup for Diary of Sankey\n'));

console.log(chalk.yellow('Your blog already has analytics infrastructure built-in!'));
console.log(chalk.gray('Here\'s how to enable analytics properly:\n'));

console.log(chalk.green.bold('🚀 RECOMMENDED: Enable Vercel Analytics (Already configured!)'));
console.log(chalk.gray('Since you\'re using Vercel hosting, Vercel Analytics is the easiest option:'));
console.log('1. Go to your Vercel dashboard: https://vercel.com/dashboard');
console.log('2. Select your "diary-of-sankey" project');
console.log('3. Go to Settings → Analytics');
console.log('4. Click "Enable Analytics"');
console.log('5. Redeploy your site');
console.log(chalk.green('✅ Your .env already has ENABLE_VERCEL_ANALYTICS=true\n'));

console.log(chalk.blue.bold('📈 OPTION 2: Add Google Analytics 4'));
console.log(chalk.gray('For detailed insights and advanced tracking:'));
console.log('1. Go to https://analytics.google.com/');
console.log('2. Create a new GA4 property');
console.log('3. Get your Measurement ID (G-XXXXXXXXXX)');
console.log('4. Add this line to your .env file:');
console.log(chalk.cyan('   GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX'));
console.log('5. Run: npm run build && npm run deploy\n');

console.log(chalk.magenta.bold('🔒 OPTION 3: Privacy-Focused Analytics'));
console.log(chalk.gray('For GDPR-compliant, cookie-free analytics:'));
console.log('1. Choose Plausible (https://plausible.io/) or Simple Analytics');
console.log('2. Add these lines to your .env file:');
console.log(chalk.cyan('   ENABLE_PLAUSIBLE=true'));
console.log(chalk.cyan('   PLAUSIBLE_DOMAIN=diary.devsanket.com'));
console.log('3. Run: npm run build && npm run deploy\n');

console.log(chalk.red.bold('⚡ QUICK START (Recommended):'));
console.log('1. Enable Vercel Analytics in your dashboard (takes 2 minutes)');
console.log('2. Your site will immediately start tracking visitors');
console.log('3. View analytics in your Vercel dashboard\n');

console.log(chalk.blue('🔧 For interactive setup, run:'));
console.log(chalk.cyan('npm run setup-analytics\n'));

console.log(chalk.green('📚 For detailed documentation, see:'));
console.log(chalk.cyan('docs/ANALYTICS_SETUP.md\n'));

console.log(chalk.yellow('Your current .env analytics settings:'));
console.log(chalk.gray('GOOGLE_ANALYTICS_ID= (empty - add your GA4 ID here)'));
console.log(chalk.gray('ENABLE_VERCEL_ANALYTICS=true (✅ ready for Vercel Analytics)'));
console.log(chalk.gray('Other analytics providers can be added as needed\n'));

console.log(chalk.green.bold('🎉 Your blog is ready for analytics!'));
console.log(chalk.gray('Choose your preferred option above and start tracking visitors.\n')); 