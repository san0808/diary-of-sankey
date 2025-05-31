# Quick Start Guide

Get your Notion-powered blog running in under 5 minutes! 🚀

## 🏃‍♂️ **Super Quick Setup**

### Step 1: Get the Code
```bash
git clone <your-repo-url>
cd diary-of-sankey
npm install
```

### Step 2: Create Notion Integration
1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it "Diary of Sankey Blog"
4. Copy the "Internal Integration Token" (starts with `ntn_` for new integrations)

### Step 3: Run Setup Wizard
```bash
npm run setup
```

The wizard will:
- ✅ Ask for your integration token
- ✅ **Automatically create your blog database**
- ✅ **Add sample blog post**
- ✅ Configure all settings
- ✅ Create `.env` file

### Step 4: Share Database (Important!)
After the database is created:
1. The setup will open the database in your browser
2. Click "Share" → "Invite" 
3. Search for your integration name
4. Give it "Full access"

### Step 5: Test Your Blog
```bash
npm run sync    # Pull content from Notion
npm run dev     # Start local server
```

Open http://localhost:3000 - you should see your blog with the sample post! 🎉

## ✍️ **Write Your First Real Post**

1. **Open your database** in Notion (bookmark it!)
2. **Click "New"** to create a post
3. **Write naturally** using all of Notion's features:
   - Headings, lists, images
   - Code blocks, math equations
   - Callouts, quotes, tables
4. **Set properties:**
   - Title: "My First Post"
   - Category: "Blog" 
   - Status: "Published"
   - Add some tags
5. **See it live:**
   ```bash
   npm run sync    # Pull your new post
   ```
   Refresh your browser - your post is now live!

## 🚀 **Deploy to Production**

### GitHub Pages (Free)
1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial blog setup"
   git push origin main
   ```

2. **Set Repository Secrets:**
   - Go to repo Settings → Secrets → Actions
   - Add `NOTION_API_KEY` (your integration token)
   - Add `NOTION_DATABASE_ID` (from your .env file)

3. **Enable GitHub Pages:**
   - Repo Settings → Pages
   - Source: "GitHub Actions"
   - Your blog will be live at `https://yourusername.github.io/diary-of-sankey`

### Netlify (Alternative)
1. **Connect repo to Netlify**
2. **Set environment variables** in Netlify dashboard
3. **Deploy automatically** on every push

## 🎯 **Daily Workflow**

Once set up, your daily blogging workflow is super simple:

1. **Open Notion** → Go to your database
2. **Click "New"** → Write your post
3. **Set status to "Published"**
4. **Wait 15 minutes** → Post appears on your blog automatically!

No git commands, no file management, no technical steps. Just pure writing! ✨

## 🔧 **If Something Goes Wrong**

### Database Creation Failed?
```bash
npm run create-database
```

### Connection Issues?
- Check your integration token starts with `ntn_` (new format) or `secret_` (legacy format)
- Make sure you shared the database with your integration
- Verify database ID is 32 characters long

### Posts Not Showing?
- Check post status is "Published"
- Ensure publish date is today or earlier
- Run `npm run sync` to pull latest changes

### Need Help?
- Check the full README.md for detailed docs
- Look at the sample post in your database for examples
- Create an issue on GitHub

---

**Happy blogging!** 📝 You now have a beautiful, fast, SEO-optimized blog powered by Notion's amazing editor. 