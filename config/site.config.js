require('dotenv').config();

/**
 * Site Configuration
 * Centralizes all configuration settings for the blog system
 */
module.exports = {
  // Core site information
  site: {
    title: process.env.BLOG_TITLE || 'Diary of Sankey',
    description: 'Personal blog of Sanket Bhat - thoughts on engineering, technology, and life',
    url: process.env.SITE_URL || 'https://diaryofsankey.com',
    language: 'en',
    timezone: 'Asia/Kolkata'
  },

  // Author information
  author: {
    name: process.env.AUTHOR_NAME || 'Sanket Bhat',
    bio: process.env.AUTHOR_BIO || 'Engineer, learner, and occasional writer',
    email: process.env.AUTHOR_EMAIL || '',
    avatar: process.env.AUTHOR_AVATAR || '/images/avatar.png',
    social: {
      twitter: process.env.AUTHOR_TWITTER || '@sankey',
      github: process.env.AUTHOR_GITHUB || 'sanket08',
      linkedin: process.env.AUTHOR_LINKEDIN || 'sanket-bhat'
    }
  },

  // Notion configuration
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID,
    version: '2022-06-28' // Notion API version
  },

  // Build configuration
  build: {
    outputDir: process.env.BUILD_DIR || 'dist',
    contentDir: process.env.CONTENT_DIR || 'content',
    assetsDir: 'assets',
    templatesDir: 'templates',
    staticDir: 'src/static'
  },

  // Content settings
  content: {
    postsPerPage: parseInt(process.env.POSTS_PER_PAGE) || 10,
    excerptLength: 200,
    dateFormat: 'MMMM do, yyyy',
    enableComments: process.env.ENABLE_COMMENTS === 'true',
    enableSearch: process.env.ENABLE_SEARCH !== 'false',
    enableRss: process.env.ENABLE_RSS !== 'false',
    enableSitemap: process.env.ENABLE_SITEMAP !== 'false'
  },

  // Categories configuration
  categories: {
    blog: {
      name: 'Blog',
      slug: 'blog',
      description: 'Personal thoughts and technical insights'
    },
    'research-notes': {
      name: 'Research Notes',
      slug: 'research-notes', 
      description: 'Deep dives into research papers and technical concepts'
    },
    math: {
      name: 'Math',
      slug: 'math',
      description: 'Mathematical explorations and explanations'
    }
  },

  // Performance settings
  performance: {
    enableImageOptimization: process.env.ENABLE_IMAGE_OPTIMIZATION !== 'false',
    enableLazyLoading: process.env.ENABLE_LAZY_LOADING !== 'false',
    enableServiceWorker: process.env.ENABLE_SERVICE_WORKER === 'true',
    imageFormats: ['webp', 'jpg'],
    imageSizes: [400, 800, 1200]
  },

  // Development settings
  development: {
    port: parseInt(process.env.DEV_PORT) || 3000,
    previewPort: parseInt(process.env.PREVIEW_PORT) || 3001,
    hotReload: process.env.HOT_RELOAD !== 'false',
    debug: process.env.DEBUG === 'true'
  },

  // External services
  services: {
    analytics: {
      googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID
    },
    webhook: {
      secret: process.env.WEBHOOK_SECRET
    },
    deployment: {
      netlify: {
        authToken: process.env.NETLIFY_AUTH_TOKEN,
        siteId: process.env.NETLIFY_SITE_ID
      }
    }
  },

  // Template settings
  templates: {
    defaultLayout: 'base',
    preserveOriginalDesign: true,
    customCss: 'src/styles/custom.css'
  }
}; 