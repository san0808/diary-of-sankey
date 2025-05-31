# Diary of Sankey

A modern, Notion-powered blog system that preserves beautiful design while providing an exceptional writing experience with **minimalist, Notion-inspired styling**.

## ✨ Recent Updates

- **🎨 Minimalist Design**: Updated code blocks and callouts with clean, Notion-inspired gray styling
- **📝 Enhanced Writing**: Seamless Notion-to-blog workflow with native rich text editing
- **🚀 Performance**: Optimized content processing and static site generation
- **📱 Responsive**: Beautiful design that works perfectly on all devices

## 🚀 Features

- **Write in Notion**: Use Notion's powerful editor for all your content - no copy/paste needed
- **Automated Publishing**: Content syncs automatically from Notion to your blog
- **Scheduling**: Schedule posts to publish at specific dates with preview system
- **Beautiful Design**: Preserves the original elegant orange theme with minimalist code styling
- **Math Support**: Full MathJax integration for mathematical equations
- **Image Optimization**: Automatic image processing and optimization
- **SEO Ready**: Automatic meta tags, sitemap, and RSS feed generation
- **Minimalist Aesthetics**: Clean, professional styling for code blocks and callouts

## 🎨 Design Philosophy

### Minimalist Code Styling
- **Code Blocks**: Subtle gray backgrounds (`bg-gray-50`) with neutral borders
- **Inline Code**: Clean gray styling that doesn't compete with content
- **Callouts**: Professional appearance that complements the orange theme
- **Notion-Inspired**: Clean, readable aesthetics that feel familiar and modern

## 📋 Prerequisites

- Node.js 16+ 
- A Notion account
- GitHub account (for deployment)
- Netlify/Vercel account (recommended for hosting)

## 🛠️ Quick Setup

1. **Clone and Install**
   ```bash
   https://github.com/san0808/diary-of-sankey.git
   cd diary-of-sankey
   npm install
   ```

2. **Run Setup Wizard**
   ```bash
   npm run setup
   ```
   This will guide you through:
   - Creating your Notion database (automatically or manually)
   - Setting up environment variables
   - Configuring your blog settings

3. **Start Development**
   ```bash
   npm run dev
   ```

## 🎯 Writing Workflow

### ✍️ **The Pure Notion Experience**

1. **Open Your Notion Database**: Navigate to your blog database in Notion
2. **Create a New Page**: Click "New" to start a fresh blog post
3. **Write Directly in Notion**: Use Notion's native editor with full rich text support:
   - Headings, paragraphs, lists with beautiful styling
   - Upload images and files directly
   - Insert code blocks with minimalist gray styling
   - Add math equations, callouts, quotes with clean aesthetics
   - Use all of Notion's formatting features naturally
4. **Set Post Properties**: 
   - Title, Category (Blog/Research Notes/Math)
   - Status (Draft → Scheduled → Published)
   - Publish Date, Tags, Featured status
5. **Publish**: Change status to "Published" - your post appears beautifully styled

### 📅 **Publishing States**
- **Draft**: Write and edit privately, won't appear on blog
- **Scheduled**: Set future publish date, shows "Coming Soon" preview with faded styling
- **Published**: Live on your blog with full minimalist styling

## 🏗️ Architecture

```
Notion Database → Notion API → Content Processor → Static Site → Deploy
                                    ↓
                        (Minimalist Styling Applied)
                                    ↓
                             Preview System
```

### Key Components

- **Notion Sync**: Fetches content from Notion API with retry logic
- **Content Processor**: Converts Notion blocks to optimized HTML with minimalist styling
- **Template Engine**: Applies your beautiful design with enhanced aesthetics
- **Asset Pipeline**: Optimizes images and static assets
- **Preview System**: Shows drafts and scheduled posts with appropriate styling

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# Notion Integration
NOTION_API_KEY=your_notion_integration_key
NOTION_DATABASE_ID=your_database_id

# Site Configuration
SITE_URL=https://diary.devsanket.com // write yours
AUTHOR_NAME=Sanket Bhat // write yours
BLOG_TITLE=Diary of Sankey // write yours

# Optional: Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run sync` | Manually sync content from Notion |
| `npm run sync -- --force` | Force regenerate all content with latest styling |
| `npm run build` | Build the static site |
| `npm run preview` | Preview the built site locally |
| `npm run deploy` | Sync + build + deploy |
| `npm test` | Run test suite |
| `npm run setup` | Interactive setup wizard |

## 🎨 Content Styling

### Notion Block Support with Minimalist Design

| Notion Block | Output Styling | Design Notes |
|--------------|---------------|--------------|
| Code Block | `bg-gray-50 border-gray-200` | Clean, subtle contrast |
| Inline Code | `bg-gray-100 border-gray-200` | Neutral, readable |
| Callout | `bg-gray-50 border-gray-200` | Professional appearance |
| Quote | `border-l-gray-300 bg-gray-50` | Elegant left border |
| Headings | Serif fonts with proper hierarchy | Maintains original beauty |
| Images | Auto-optimized, responsive | Perfect performance |
| Math | MathJax rendered, centered | Clean mathematical display |

## 🚀 Deployment

### GitHub Actions (Recommended)

1. **Set up repository secrets**:
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID`
   - `NETLIFY_AUTH_TOKEN` (or Vercel token)
   - `NETLIFY_SITE_ID` (or Vercel project ID)

2. **Push to main branch** - deployment happens automatically

### Manual Deployment

```bash
npm run deploy
```

## 📈 Performance & SEO

- **Static Site Generation**: Lightning-fast loading
- **Image Optimization**: WebP format with responsive sizing
- **Clean Code**: Minimalist styling with optimized CSS
- **SEO Optimized**: Automatic meta tags, structured data
- **Accessibility**: Proper heading structure, semantic HTML
- **Mobile-First**: Responsive design that works everywhere

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run sync tests
npm test -- notion-sync.test.js
```

## 📚 Documentation

- [`docs/QUICK_START.md`](docs/QUICK_START.md) - Get running in 5 minutes
- [`docs/NOTION_SETUP.md`](docs/NOTION_SETUP.md) - Detailed Notion configuration
- [`docs/WRITING_EXAMPLE.md`](docs/WRITING_EXAMPLE.md) - See how writing translates

## 🛠️ Customization

### Design Modifications
- Templates in `/templates/` preserve the original aesthetic
- Code styling can be customized in `scripts/utils/content-processor.js`
- Color scheme follows minimalist Notion-inspired design

### Content Processing
- New block types can be added to the content processor
- Styling follows the established minimalist philosophy
- All changes maintain the beautiful original design

## 🔒 Security & Best Practices

- **Environment Variables**: Sensitive data stored securely
- **Content Validation**: Input sanitization and validation
- **Rate Limiting**: Notion API request throttling with retry logic
- **Clean Builds**: Generated files excluded from version control

## 📄 File Structure

```
diary-of-sankey/
├── scripts/              # Build and sync scripts
│   └── utils/            # Content processor with minimalist styling
├── templates/            # HTML templates (preserving original design)
├── static/               # Static assets
├── content/              # Generated content (gitignored)
├── dist/                 # Built site (gitignored)
├── docs/                 # Documentation
├── tests/                # Test files
└── config/               # Configuration files
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes with `npm test`
4. Ensure styling follows minimalist philosophy
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Happy Writing!** 📝 Experience the perfect blend of Notion's powerful editor and beautiful, minimalist blog design. 