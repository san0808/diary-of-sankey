# Open Graph (OG) Images Setup

This guide explains how to set up and use the automated OG image generation system for your blog. OG images are the visual previews that appear when your links are shared on social media platforms like Twitter, Facebook, and LinkedIn.

## What Are OG Images?

Open Graph images are social media preview images that appear when your content is shared. They're crucial for:
- **Higher click-through rates** - Attractive images catch attention in social feeds
- **Professional appearance** - Consistent branding across all shared links  
- **Better engagement** - Visual content performs better on social platforms

## Features

✅ **Automatic generation** for posts without featured images  
✅ **1200x630px dimensions** - perfect for all social platforms  
✅ **Branded design** matching your blog's aesthetic  
✅ **Category-specific images** for blog sections  
✅ **Fallback images** for homepage and general sharing  
✅ **Smart caching** - only regenerates when needed  
✅ **Cleanup** of old/unused images  

## Configuration

The OG image system is configured in `config/site.config.js`:

```javascript
ogImages: {
  enabled: process.env.ENABLE_OG_IMAGES !== 'false',           // Enable/disable system
  generateFallbacks: process.env.GENERATE_OG_FALLBACKS !== 'false', // Generate for all posts
  dimensions: {
    width: 1200,      // Social media standard
    height: 630       // 1.91:1 aspect ratio
  },
  fallbackToFeatured: true,  // Use featured image if available
  brandColors: {
    primary: '#EA580C',      // Orange-600 - your brand color
    background: '#FFF7ED',   // Orange-50 - light background
    text: '#1F2937',         // Gray-800 - dark text
    textSecondary: '#6B7280' // Gray-500 - secondary text
  }
}
```

## Environment Variables

Add these to your `.env` file for customization:

```bash
# OG Images (Optional - defaults shown)
ENABLE_OG_IMAGES=true              # Enable OG image generation
GENERATE_OG_FALLBACKS=false        # Generate for posts with featured images too
```

## How It Works

### 1. **Priority System**
The system uses a smart priority for choosing OG images:

1. **Featured Image** (if post has one)
2. **Generated OG Image** (custom branded image)
3. **Author Avatar** (ultimate fallback)

### 2. **Image Types Generated**

- **Default Image** (`/og-images/default.png`) - Homepage and general sharing
- **Category Images** (`/og-images/category-[slug].png`) - For blog sections
- **Post Images** (`/og-images/post-[slug].png`) - Individual posts

### 3. **Design Elements**

Each generated image includes:
- **Blog title** at the top
- **Post/category title** (main headline)
- **Category badge** with your brand color
- **Author name** and reading time
- **Gradient background** matching your theme
- **Brand accent line** for visual consistency

## Testing

Test the OG image generation:

```bash
npm run test:og
```

This generates sample images to verify everything works correctly.

## Integration

### During Build Process

OG images are automatically generated during the build:

```bash
npm run build
```

The build process will:
1. Generate default and category images
2. Create post-specific images for posts without featured images
3. Clean up old/unused images
4. Update meta tags to use the generated images

### Meta Tags

The system automatically updates your HTML meta tags:

```html
<!-- Open Graph -->
<meta property="og:image" content="https://yoursite.com/og-images/post-example.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://yoursite.com/og-images/post-example.png" />
```

## Best Practices

### 1. **Keep Titles Concise**
- Long titles automatically wrap to multiple lines
- Titles longer than 3 lines get truncated with "..."
- Aim for 6-8 words for best visual impact

### 2. **Use Categories Effectively**
- Categories get their own branded images
- Category descriptions appear on category OG images
- Keep category names short and descriptive

### 3. **Leverage Featured Images**
- Posts with featured images use them for OG images
- Generated images serve as fallbacks for posts without featured images
- You can force generation for all posts with `GENERATE_OG_FALLBACKS=true`

### 4. **Brand Consistency**
- Generated images match your blog's color scheme
- Typography uses serif fonts matching your blog design
- Brand accent line provides visual consistency

## Troubleshooting

### Images Not Generating

1. **Check if enabled**: Verify `ENABLE_OG_IMAGES=true` in your `.env`
2. **Check dependencies**: Ensure Sharp is installed: `npm install sharp`
3. **Check logs**: Look for OG image generation messages during build
4. **Test manually**: Run `npm run test:og` to isolate issues

### Images Not Appearing on Social Media

1. **Clear social media cache**:
   - Facebook: [Sharing Debugger](https://developers.facebook.com/tools/debug)
   - Twitter: [Card Validator](https://cards-dev.twitter.com/validator)
   - LinkedIn: [Post Inspector](https://www.linkedin.com/post-inspector/)

2. **Check meta tags**: View page source to verify OG image URLs are correct

3. **Verify image accessibility**: Ensure images are publicly accessible at the URLs

### Performance Considerations

- Images are only generated when needed (smart caching)
- Old images are automatically cleaned up
- Generation typically adds 2-5 seconds to build time
- Generated images are optimized PNG files (~50-100KB each)

## File Structure

After generation, your build will include:

```
dist/
├── og-images/
│   ├── default.png              # Homepage/fallback
│   ├── category-blog.png        # Blog category
│   ├── category-research-notes.png  # Research category
│   ├── category-math.png        # Math category
│   ├── post-your-post-slug.png  # Individual posts
│   └── ...
└── ...
```

## Customization

### Styling

To customize the appearance, modify `scripts/utils/og-image-generator.js`:

- **Colors**: Update the SVG gradients and color values
- **Typography**: Modify font sizes and families in the CSS styles
- **Layout**: Adjust text positioning and sizing
- **Background**: Change gradient colors or add patterns

### Adding New Templates

You can add new OG image templates by:

1. Creating new methods in `OGImageGenerator` class
2. Adding corresponding generation logic in `generateOGImages()` 
3. Updating the build system to call your new templates

## Analytics & Monitoring

Track the effectiveness of your OG images:

- **Social media analytics**: Monitor click-through rates on shared links
- **Google Analytics**: Track social referral traffic
- **Twitter Analytics**: View engagement on tweets with your links
- **Facebook Insights**: Monitor post performance and reach

Good OG images typically increase social media click-through rates by 10-30%.

## Support

If you encounter issues:

1. Check the build logs for OG image generation messages
2. Verify your Sharp installation: `npm list sharp`
3. Test with sample data: `npm run test:og`
4. Review the generated images in `dist/og-images/`

The OG image system is designed to work seamlessly with your existing blog setup and requires no manual intervention once configured. 