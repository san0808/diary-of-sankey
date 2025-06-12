# Vercel Deployment Guide

Complete guide to deploy your Diary of Sankey blog on Vercel with automatic Notion synchronization.

## 🚀 **Quick Deployment**

### Step 1: Prepare Your Repository

1. **Push to GitHub** (if not already done):
   ```bash
   git remote add origin https://github.com/san0808/diary-of-sankey.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Configure project settings**:
   - **Framework Preset**: Other
   - **Build Command**: `npm run deploy`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

### Step 3: Set Environment Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

#### Required Variables:
```
NOTION_API_KEY=your_notion_integration_key
NOTION_DATABASE_ID=your_database_id
SITE_URL=https://your-project.vercel.app
AUTHOR_NAME=Sanket Bhat
BLOG_TITLE=Diary of Sankey
```

#### Optional Variables:
```
AUTHOR_BIO=Just love tinkering things around
AUTHOR_EMAIL=your-email@example.com
AUTHOR_TWITTER=SanketBhat11
AUTHOR_GITHUB=san0808
AUTHOR_LINKEDIN=sanket-bhat-286a1a1b7
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
NODE_ENV=production
```

### Step 4: Set Up Auto-Sync Deploy Hook

1. **Create Deploy Hook** in Vercel:
   - Go to Project Settings → Git → Deploy Hooks
   - Create hook with name "Auto Sync from Notion"
   - Copy the webhook URL (looks like: `https://api.vercel.com/v1/integrations/deploy/...`)

2. **Add GitHub Secret**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `VERCEL_DEPLOY_HOOK`
   - Value: The webhook URL from step 1

3. **Test Auto-Sync**:
   - Go to GitHub Actions → "Auto Sync with Notion" → "Run workflow"
   - Should complete successfully and trigger Vercel deployment!

### Step 5: Deploy

Click **"Deploy"** - your blog will be live in ~2 minutes! 🎉

## ⚙️ **Automatic Updates**

### Option 1: Git-based Updates (Recommended)
Every time you push to `main` branch, Vercel automatically:
1. Syncs content from Notion
2. Builds your site
3. Deploys the updates

### Option 2: Notion Webhook (Advanced)
Set up automatic deployment when you publish posts in Notion:

1. **Create a Deploy Hook** in Vercel:
   - Go to Project Settings → Git → Deploy Hooks
   - Create hook with name "Notion Updates"
   - Copy the webhook URL

2. **Set up Notion Automation** (using services like Zapier):
   - Trigger: "Database item updated" in your blog database
   - Filter: Status = "Published"
   - Action: POST request to your Vercel deploy hook

## 🌐 **Custom Domain Setup**

1. **Add your domain** in Vercel:
   - Project Settings → Domains
   - Add `yourdomain.com` and `www.yourdomain.com`

2. **Update DNS settings**:
   - Add CNAME record: `www` → `cname.vercel-dns.com`
   - Add A record: `@` → `76.76.19.61`

3. **Update site URL**:
   - Update `SITE_URL` environment variable to your custom domain
   - Redeploy to apply changes

## 📊 **Performance & Monitoring**

### Analytics (Built-in)
Your Vercel dashboard shows:
- **Page views** and **unique visitors**
- **Core Web Vitals** performance
- **Function execution** (if using serverless functions)

### Google Analytics (Optional)
Set `GOOGLE_ANALYTICS_ID` environment variable for detailed analytics.

## 🔧 **Advanced Configuration**

### Preview Deployments
Vercel automatically creates preview deployments for:
- **Pull requests** → `your-pr-123.vercel.app`
- **Branch pushes** → `your-branch.your-project.vercel.app`

### Environment-specific Variables
Set different values for **Development**, **Preview**, and **Production**:
- Development: Local `.env` file
- Preview: Vercel environment variables
- Production: Vercel environment variables

### Build Optimization
Your `vercel.json` includes:
- **Clean URLs**: `/blog/my-post` instead of `/blog/my-post.html`
- **Cache headers**: Optimized for static assets
- **Redirects**: SEO-friendly URL management

## 🚨 **Troubleshooting**

### Build Fails
1. **Check Environment Variables**: Ensure `NOTION_API_KEY` and `NOTION_DATABASE_ID` are set
2. **View Build Logs**: Vercel dashboard → Deployments → Click failed deployment
3. **Test Locally**: Run `npm run deploy` locally to reproduce issues

### Content Not Updating
1. **Manual Redeploy**: Trigger deployment in Vercel dashboard
2. **Check Notion Access**: Ensure integration has access to database
3. **Review Posts**: Verify post status is "Published" and publish date is valid

### 404 Errors
1. **Check Rewrites**: Ensure `vercel.json` rewrites match your URL structure
2. **Verify Build Output**: Check that HTML files are generated in `dist/`
3. **Clear Cache**: Force refresh or check in incognito mode

## 📱 **Mobile & SEO**

Your blog is automatically optimized with:
- **Mobile-responsive design**
- **Fast loading** (static site generation)
- **SEO-friendly URLs** (clean URLs enabled)
- **Automatic sitemap** generation
- **RSS feed** for subscribers
- **Open Graph** meta tags for social sharing

## 🔄 **Maintenance**

### Regular Tasks
- **Monitor build status** in Vercel dashboard
- **Update dependencies** occasionally (`npm update`)
- **Check Core Web Vitals** for performance

### Content Management
- **Write in Notion** as usual
- **Set status to "Published"** to make posts live
- **Use "Scheduled"** for future posts
- **Keep "Draft"** for work-in-progress

## 🎯 **Best Practices**

1. **Use Preview Deployments**: Test changes on preview URLs before merging
2. **Environment Variables**: Keep sensitive data in Vercel dashboard, not in code
3. **Performance Monitoring**: Check Web Vitals regularly
4. **Content Strategy**: Use Notion's rich editing for better content
5. **SEO**: Write compelling titles and excerpts for better search ranking

---

**Your blog is now live with automatic updates from Notion!** 🚀

**Example URLs:**
- Homepage: `https://your-project.vercel.app`
- Blog post: `https://your-project.vercel.app/blog/my-first-post`
- Category: `https://your-project.vercel.app/blog`
- RSS feed: `https://your-project.vercel.app/rss.xml` 