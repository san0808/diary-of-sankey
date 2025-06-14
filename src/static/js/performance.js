// Performance Optimization Script for Diary of Sankey
// Implements link prefetching, resource optimization, and navigation speed improvements

(function() {
  'use strict';

  // Performance configuration
  const PERFORMANCE_CONFIG = {
    prefetch: {
      enabled: true,
      hoverDelay: 100, // ms to wait before prefetching on hover
      intersectionThreshold: 0.1, // Prefetch when 10% visible
      maxConcurrentPrefetches: 3,
      cacheSize: 10 // Maximum cached pages
    },
    lazyLoading: {
      enabled: true,
      rootMargin: '50px',
      threshold: 0.1
    },
    analytics: {
      enabled: typeof gtag !== 'undefined'
    }
  };

  // Performance tracking
  const performanceTracker = {
    prefetchCache: new Map(),
    prefetchQueue: [],
    activePrefetches: 0,
    
    // Track navigation performance
    trackNavigation: function(url, startTime) {
      const loadTime = Date.now() - startTime;
      
      if (PERFORMANCE_CONFIG.analytics.enabled) {
        gtag('event', 'page_navigation', {
          event_category: 'performance',
          event_label: url,
          value: loadTime,
          custom_parameters: {
            load_time: loadTime,
            cache_hit: this.prefetchCache.has(url)
          }
        });
      }
      
      console.log(`🚀 Navigation to ${url}: ${loadTime}ms ${this.prefetchCache.has(url) ? '(cached)' : '(fresh)'}`);
    },

    // Track prefetch performance
    trackPrefetch: function(url, success, loadTime) {
      if (PERFORMANCE_CONFIG.analytics.enabled) {
        gtag('event', 'prefetch', {
          event_category: 'performance',
          event_label: url,
          value: loadTime,
          custom_parameters: {
            success: success,
            load_time: loadTime
          }
        });
      }
    }
  };

  // Link prefetching implementation
  const linkPrefetcher = {
    init: function() {
      if (!PERFORMANCE_CONFIG.prefetch.enabled) return;
      
      this.setupHoverPrefetching();
      this.setupIntersectionPrefetching();
      this.setupNavigationInterception();
      
      console.log('🔗 Link prefetching initialized');
    },

    // Prefetch on hover with delay
    setupHoverPrefetching: function() {
      let hoverTimeout;
      
      document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (!link) return;
        
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          this.prefetchPage(link.href, 'hover');
        }, PERFORMANCE_CONFIG.prefetch.hoverDelay);
      });

      document.addEventListener('mouseout', (e) => {
        clearTimeout(hoverTimeout);
      });
    },

    // Prefetch links when they come into view
    setupIntersectionPrefetching: function() {
      if (!('IntersectionObserver' in window)) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const link = entry.target;
            this.prefetchPage(link.href, 'intersection');
            observer.unobserve(link); // Only prefetch once
          }
        });
      }, {
        rootMargin: PERFORMANCE_CONFIG.lazyLoading.rootMargin,
        threshold: PERFORMANCE_CONFIG.prefetch.intersectionThreshold
      });

      // Observe all internal links
      document.querySelectorAll('a[href^="/"]').forEach(link => {
        observer.observe(link);
      });
    },

    // Intercept navigation for instant loading
    setupNavigationInterception: function() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
        
        const url = link.href;
        const startTime = Date.now();
        
        // If page is prefetched, navigation will be instant
        if (performanceTracker.prefetchCache.has(url)) {
          console.log(`⚡ Instant navigation to ${url} (prefetched)`);
        }
        
        // Track navigation performance
        setTimeout(() => {
          performanceTracker.trackNavigation(url, startTime);
        }, 100);
      });
    },

    // Core prefetching logic
    prefetchPage: function(url, trigger) {
      // Skip if already cached or in queue
      if (performanceTracker.prefetchCache.has(url) || 
          performanceTracker.prefetchQueue.includes(url)) {
        return;
      }

      // Respect concurrency limits
      if (performanceTracker.activePrefetches >= PERFORMANCE_CONFIG.prefetch.maxConcurrentPrefetches) {
        performanceTracker.prefetchQueue.push(url);
        return;
      }

      this.executePrefetch(url, trigger);
    },

    // Execute the actual prefetch
    executePrefetch: function(url, trigger) {
      const startTime = Date.now();
      performanceTracker.activePrefetches++;

      // Create prefetch link element
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      
      link.onload = () => {
        const loadTime = Date.now() - startTime;
        
        // Cache the prefetched page
        this.cachePageContent(url);
        
        performanceTracker.activePrefetches--;
        performanceTracker.trackPrefetch(url, true, loadTime);
        
        console.log(`✅ Prefetched ${url} via ${trigger} (${loadTime}ms)`);
        
        // Process queue
        this.processQueue();
      };

      link.onerror = () => {
        const loadTime = Date.now() - startTime;
        performanceTracker.activePrefetches--;
        performanceTracker.trackPrefetch(url, false, loadTime);
        
        console.warn(`❌ Failed to prefetch ${url}`);
        
        // Process queue
        this.processQueue();
      };

      document.head.appendChild(link);
    },

    // Cache page content for instant navigation
    cachePageContent: function(url) {
      // Implement cache size limit
      if (performanceTracker.prefetchCache.size >= PERFORMANCE_CONFIG.prefetch.cacheSize) {
        const firstKey = performanceTracker.prefetchCache.keys().next().value;
        performanceTracker.prefetchCache.delete(firstKey);
      }
      
      performanceTracker.prefetchCache.set(url, {
        timestamp: Date.now(),
        prefetched: true
      });
    },

    // Process prefetch queue
    processQueue: function() {
      if (performanceTracker.prefetchQueue.length > 0 && 
          performanceTracker.activePrefetches < PERFORMANCE_CONFIG.prefetch.maxConcurrentPrefetches) {
        const nextUrl = performanceTracker.prefetchQueue.shift();
        this.executePrefetch(nextUrl, 'queue');
      }
    }
  };

  // Resource optimization
  const resourceOptimizer = {
    init: function() {
      this.optimizeImages();
      this.optimizeScripts();
      this.addResourceHints();
      
      console.log('🎯 Resource optimization initialized');
    },

    // Optimize image loading
    optimizeImages: function() {
      if (!PERFORMANCE_CONFIG.lazyLoading.enabled || !('IntersectionObserver' in window)) return;

      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Load the image
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            
            // Add fade-in effect
            img.style.opacity = '0';
            img.onload = () => {
              img.style.transition = 'opacity 0.3s';
              img.style.opacity = '1';
            };
            
            imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: PERFORMANCE_CONFIG.lazyLoading.rootMargin,
        threshold: PERFORMANCE_CONFIG.lazyLoading.threshold
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    },

    // Optimize script loading
    optimizeScripts: function() {
      // Defer non-critical scripts
      const nonCriticalScripts = document.querySelectorAll('script[data-defer]');
      nonCriticalScripts.forEach(script => {
        script.defer = true;
      });
    },

    // Add resource hints for better performance
    addResourceHints: function() {
      const hints = [
        { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
        { rel: 'dns-prefetch', href: '//www.googletagmanager.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true }
      ];

      hints.forEach(hint => {
        const link = document.createElement('link');
        Object.assign(link, hint);
        document.head.appendChild(link);
      });
    }
  };

  // Performance monitoring
  const performanceMonitor = {
    init: function() {
      this.trackPageLoad();
      this.trackResourceTiming();
      this.trackUserInteractions();
      
      console.log('📊 Performance monitoring initialized');
    },

    trackPageLoad: function() {
      window.addEventListener('load', () => {
        // Use Performance API if available
        if ('performance' in window) {
          const navigation = performance.getEntriesByType('navigation')[0];
          const loadTime = navigation.loadEventEnd - navigation.fetchStart;
          
          if (PERFORMANCE_CONFIG.analytics.enabled) {
            gtag('event', 'page_load_time', {
              event_category: 'performance',
              value: Math.round(loadTime),
              custom_parameters: {
                dom_content_loaded: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
                first_paint: this.getFirstPaint(),
                page_size: this.getPageSize()
              }
            });
          }
          
          console.log(`📈 Page load performance: ${Math.round(loadTime)}ms`);
        }
      });
    },

    trackResourceTiming: function() {
      if (!('performance' in window)) return;

      window.addEventListener('load', () => {
        const resources = performance.getEntriesByType('resource');
        const slowResources = resources.filter(resource => resource.duration > 1000);
        
        if (slowResources.length > 0) {
          console.warn('🐌 Slow resources detected:', slowResources);
        }
      });
    },

    trackUserInteractions: function() {
      // Track time to first interaction
      let firstInteraction = null;
      
      ['click', 'keydown', 'scroll'].forEach(eventType => {
        document.addEventListener(eventType, () => {
          if (!firstInteraction) {
            firstInteraction = Date.now();
            
            if (PERFORMANCE_CONFIG.analytics.enabled) {
              gtag('event', 'first_interaction', {
                event_category: 'performance',
                value: firstInteraction - performance.timing.navigationStart
              });
            }
          }
        }, { once: true });
      });
    },

    getFirstPaint: function() {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? Math.round(firstPaint.startTime) : null;
    },

    getPageSize: function() {
      const resources = performance.getEntriesByType('resource');
      return resources.reduce((total, resource) => total + (resource.transferSize || 0), 0);
    }
  };

  // Initialize all performance optimizations
  function initializePerformanceOptimizations() {
    console.log('🚀 Initializing performance optimizations...');
    
    linkPrefetcher.init();
    resourceOptimizer.init();
    performanceMonitor.init();
    
    console.log('✅ Performance optimizations ready');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePerformanceOptimizations);
  } else {
    initializePerformanceOptimizations();
  }

  // Expose performance utilities globally for debugging
  window.DiaryPerformance = {
    prefetchCache: performanceTracker.prefetchCache,
    prefetchPage: linkPrefetcher.prefetchPage.bind(linkPrefetcher),
    getMetrics: () => ({
      prefetchCacheSize: performanceTracker.prefetchCache.size,
      activePrefetches: performanceTracker.activePrefetches,
      queueLength: performanceTracker.prefetchQueue.length
    })
  };

})(); 