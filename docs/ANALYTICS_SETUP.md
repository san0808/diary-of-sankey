# Analytics Setup Guide

Complete guide to set up analytics tracking for your Diary of Sankey blog with multiple provider options.

## 🚀 Quick Setup

Run the interactive analytics setup:

```bash
npm run setup-analytics
```

This will guide you through configuring analytics providers and update your `.env` file automatically.

## 📊 Available Analytics Providers

### 1. Google Analytics 4 (Recommended for detailed insights)

**Pros:**
- Most comprehensive analytics platform
- Detailed user behavior tracking
- Free with generous limits
- Advanced reporting and insights
- Integration with Google Ads

**Setup:**
1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property or use existing one
3. Get your Measurement ID (format: `G-XXXXXXXXXX`)
4. Add to your `.env` file:
   ```env
   GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
   ```

### 2. Vercel Analytics (Recommended for Vercel hosting)

**Pros:**
- Built-in with Vercel hosting
- Privacy-focused (no cookies)
- Real-time data
- Core Web Vitals tracking
- Zero configuration needed

**Setup:**
1. Go to your Vercel dashboard
2. Select your project
3. Navigate to Settings → Analytics
4. Enable Analytics
5. Set in your `.env` file:
   ```env
   ENABLE_VERCEL_ANALYTICS=true
   ```

### 3. Plausible Analytics (Privacy-focused)

**Pros:**
- GDPR compliant
- No cookies or personal data collection
- Lightweight script (< 1KB)
- Simple, clean dashboard
- Open source

**Setup:**
1. Go to [Plausible.io](https://plausible.io/)
2. Create an account and add your site
3. Configure in your `.env` file:
   ```env
   ENABLE_PLAUSIBLE=true
   PLAUSIBLE_DOMAIN=your-domain.com
   ```

### 4. Simple Analytics (Lightweight & Private)

**Pros:**
- Privacy-focused
- Very lightweight
- No cookies
- Simple dashboard
- GDPR compliant

**Setup:**
1. Go to [Simple Analytics](https://simpleanalytics.com/)
2. Create an account and add your site
3. Enable in your `.env` file:
   ```env
   ENABLE_SIMPLE_ANALYTICS=true
   ```

## 🔧 Manual Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Google Analytics 4
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Plausible Analytics
ENABLE_PLAUSIBLE=true
PLAUSIBLE_DOMAIN=your-domain.com

# Vercel Analytics
ENABLE_VERCEL_ANALYTICS=true

# Simple Analytics
ENABLE_SIMPLE_ANALYTICS=false

# Custom Analytics (for other providers)
ENABLE_CUSTOM_ANALYTICS=false
CUSTOM_ANALYTICS_CODE=
```

### Multiple Providers

You can enable multiple analytics providers simultaneously:

```env
# Enable both Google Analytics and Vercel Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
ENABLE_VERCEL_ANALYTICS=true
ENABLE_PLAUSIBLE=false
ENABLE_SIMPLE_ANALYTICS=false
```

## 📈 Analytics Features

### Automatic Tracking

Your blog automatically tracks:
- **Page views** on all pages
- **Unique visitors**
- **Referrer information**
- **Device and browser data**
- **Geographic location** (where permitted)

### Enhanced Google Analytics Tracking

When Google Analytics is enabled, additional data is tracked:
- **Page titles** for better content analysis
- **Canonical URLs** for accurate page identification
- **Custom events** (can be extended)

### Privacy Considerations

- **Vercel Analytics**: No cookies, privacy-focused by design
- **Plausible**: GDPR compliant, no personal data collection
- **Simple Analytics**: No cookies, minimal data collection
- **Google Analytics**: Uses cookies, provides opt-out mechanisms

## 🚀 Deployment

### Vercel Deployment

Analytics are automatically configured when you deploy to Vercel:

1. **Environment Variables**: Set in Vercel dashboard → Settings → Environment Variables
2. **Vercel Analytics**: Enable in project settings
3. **Deploy**: Analytics will be active immediately

### Other Hosting Providers

For other hosting providers:

1. **Set Environment Variables**: Configure in your hosting platform
2. **Build and Deploy**: Run `npm run deploy`
3. **Verify**: Check that analytics scripts are loaded

## 📊 Monitoring and Verification

### Verify Analytics Installation

1. **View Source**: Check that analytics scripts are loaded in your HTML
2. **Browser DevTools**: Look for analytics requests in Network tab
3. **Real-time Data**: Check your analytics dashboard for real-time visitors

### Google Analytics Verification

```javascript
// Check if Google Analytics is loaded
if (typeof gtag !== 'undefined') {
  console.log('Google Analytics is loaded');
}
```

### Vercel Analytics Verification

```javascript
// Check if Vercel Analytics is loaded
if (typeof window.va !== 'undefined') {
  console.log('Vercel Analytics is loaded');
}
```

## 🔍 Troubleshooting

### Analytics Not Working

1. **Check Environment Variables**: Ensure they're set correctly
2. **Rebuild Site**: Run `npm run build` after changes
3. **Clear Cache**: Hard refresh your browser
4. **Check Console**: Look for JavaScript errors

### Google Analytics Issues

- **Invalid Measurement ID**: Must be format `G-XXXXXXXXXX`
- **Property Setup**: Ensure GA4 property is created correctly
- **Data Processing**: Can take 24-48 hours for data to appear

### Vercel Analytics Issues

- **Hosting Platform**: Only works with Vercel hosting
- **Project Settings**: Must be enabled in Vercel dashboard
- **Deployment**: Requires redeployment after enabling

## 📋 Best Practices

### Privacy Compliance

1. **Cookie Notice**: Add cookie consent for Google Analytics
2. **Privacy Policy**: Update to mention analytics tracking
3. **Opt-out Options**: Provide analytics opt-out mechanisms

### Performance Optimization

1. **Async Loading**: All analytics scripts load asynchronously
2. **Minimal Impact**: Choose lightweight providers when possible
3. **Multiple Providers**: Consider performance impact of multiple trackers

### Data Analysis

1. **Set Goals**: Define what metrics matter for your blog
2. **Regular Review**: Check analytics data weekly/monthly
3. **Content Optimization**: Use data to improve popular content

## 🎯 Recommended Setups

### For Personal Blogs
```env
ENABLE_VERCEL_ANALYTICS=true
ENABLE_PLAUSIBLE=true
```

### For Professional Blogs
```env
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
ENABLE_VERCEL_ANALYTICS=true
```

### For Privacy-Focused Blogs
```env
ENABLE_PLAUSIBLE=true
ENABLE_SIMPLE_ANALYTICS=false
```

## 🔗 Useful Links

- [Google Analytics 4 Setup Guide](https://support.google.com/analytics/answer/9304153)
- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Plausible Analytics Documentation](https://plausible.io/docs)
- [Simple Analytics Documentation](https://docs.simpleanalytics.com/)

---

**Need help?** Run `npm run setup-analytics` for interactive setup or check the troubleshooting section above. 