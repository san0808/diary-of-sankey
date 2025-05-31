# Notion Database Setup & Writing Workflow

## 📝 **Writing Workflow Overview**

1. **Write in Notion**: Create and write your blog posts directly in Notion pages
2. **Set Metadata**: Configure post properties (category, status, publish date, etc.)
3. **Publish**: Change status to "Published" - your post appears on your blog within 15 minutes
4. **That's it!** No copying, pasting, or manual content management needed

## 🗄️ **Database Properties Setup**

Create a Notion database with these exact properties:

### Required Properties:
- **Title** (Title) - Your blog post title
- **Status** (Select) - Options: `Draft`, `Scheduled`, `Published`, `Archived`
- **Category** (Select) - Options: `Blog`, `Research Notes`, `Math`
- **Publish Date** (Date) - When the post should be published

### Optional Properties:
- **Tags** (Multi-select) - Add relevant tags for your post
- **Slug** (Rich text) - Custom URL slug (auto-generated from title if empty)
- **Excerpt** (Rich text) - Post summary (auto-generated if empty)
- **Featured Image** (Files) - Hero image for your post
- **Featured** (Checkbox) - Mark as featured post for homepage

## ✍️ **Writing Your First Post**

### Step 1: Create a New Page
1. Open your Notion database
2. Click "New" to create a new page
3. Fill in the properties:
   - **Title**: "My First Blog Post"
   - **Status**: `Draft` (start here)
   - **Category**: `Blog`
   - **Publish Date**: Leave empty for now

### Step 2: Write Your Content
Now write directly in the Notion page using all of Notion's features:

#### Text Formatting
```
This is a **bold** statement and this is *italic*.
You can also use `inline code` and ~~strikethrough~~.
```

#### Headings
Use Notion's heading blocks:
- # Heading 1
- ## Heading 2  
- ### Heading 3

#### Lists
- Create bulleted lists
- With multiple items
  - And nested items

1. Or numbered lists
2. With sequential numbering
3. That auto-increment

#### Code Blocks
```javascript
function hello() {
  console.log('Hello from Notion!');
}
```

#### Math Equations
Use Notion's equation blocks:
- Inline: $E = mc^2$
- Block: $$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$

#### Images
- Upload images directly to Notion
- Add captions for better context
- Images are automatically optimized for your blog

#### Callouts
> 💡 Use Notion's callout blocks for important information
> They get styled beautifully on your blog

#### Quotes
> "This is a quote block that will be styled nicely on your blog"

### Step 3: Preview (Optional)
- Run `npm run sync` locally to see how it looks
- Or keep status as `Draft` and it won't appear publicly

### Step 4: Publish
1. Set **Status** to `Published`
2. Set **Publish Date** to today (or leave empty for "now")
3. Your post will appear on your blog within 15 minutes!

## 📅 **Scheduling Posts**

1. Write your post in Notion
2. Set **Status** to `Scheduled`
3. Set **Publish Date** to a future date
4. The post will automatically publish on that date
5. Scheduled posts show with a "Coming Soon" preview on your homepage

## 🏷️ **Content Organization**

### Categories
- **Blog**: Personal thoughts, tutorials, general posts
- **Research Notes**: Deep technical content, paper reviews
- **Math**: Mathematical explorations, proofs, explanations

### Tags
- Add relevant tags like: `javascript`, `ai`, `productivity`, `tutorial`
- Tags help readers discover related content
- They're automatically indexed for filtering

## 🎨 **Rich Content Examples**

### Tables
| Feature | Supported | Notes |
|---------|-----------|-------|
| Headers | ✅ | All heading levels |
| Images | ✅ | Auto-optimized |
| Code | ✅ | Syntax highlighting |
| Math | ✅ | MathJax rendering |

### Embeds
- Paste YouTube, Twitter, GitHub links
- They'll be embedded properly in your blog

### Files
- Upload PDFs, documents
- They'll be linked in your blog post

## 🔄 **Sync Process**

The system automatically:
1. **Fetches** your Notion content via API
2. **Converts** Notion blocks to styled HTML
3. **Preserves** your blog's original design
4. **Optimizes** images and performance
5. **Generates** RSS feeds, sitemaps, indexes
6. **Deploys** to your live site

## 💡 **Pro Tips**

### Writing Tips
- Use Notion's outline view to organize long posts
- Leverage templates for consistent post structure
- Use the database view to manage multiple posts

### SEO Tips
- Write compelling titles (they become your SEO title)
- Add good excerpts (they become meta descriptions)
- Use relevant tags (they help with discoverability)

### Publishing Tips
- Start with `Draft` status while writing
- Use `Scheduled` for planned releases
- Set `Featured` checkbox for homepage highlights

## 🚨 **Important Notes**

### What Syncs Automatically
- ✅ Page content (all blocks)
- ✅ Property values (title, status, etc.)
- ✅ Images and files
- ✅ Formatting and styling

### What Doesn't Sync
- ❌ Comments on Notion pages
- ❌ Page history/versions
- ❌ Database views and filters
- ❌ Notion-specific features (databases within pages)

### Best Practices
- Keep your database organized
- Use consistent naming for categories/tags
- Don't change property names after setup
- Test with drafts before publishing

## 🔧 **Troubleshooting**

### My post isn't showing up
1. Check the **Status** is `Published`
2. Verify **Publish Date** is today or earlier
3. Ensure the page is in the correct database
4. Check your integration has access to the page

### Images aren't loading
1. Make sure images are uploaded to Notion (not external links)
2. Check the integration has access to files
3. Verify image formats are supported (jpg, png, gif, webp)

### Formatting looks wrong
1. The system preserves your original blog design
2. Some Notion-specific blocks may not be supported yet
3. Check the logs for any conversion errors

---

**Ready to start writing?** Create your first Notion page and watch it appear on your beautiful blog! 🚀 