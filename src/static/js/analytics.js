// Advanced Analytics Tracking for Diary of Sankey
(function() {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    
    // Only proceed if gtag is available (Google Analytics loaded)
    if (typeof gtag === 'undefined') {
      return;
    }

    // Track reading progress on blog posts
    if (document.body.classList.contains('blog-post')) {
      trackReadingProgress();
    }

    // Track outbound link clicks
    trackOutboundLinks();

    // Track social media clicks
    trackSocialClicks();
  });

  function trackReadingProgress() {
    var readingProgress = 0;
    var maxScroll = 0;
    var content = document.getElementById('blog-content');
    var pageTitle = document.title;
    
    if (!content) return;

    // Track scroll depth
    window.addEventListener('scroll', function() {
      var scrollTop = window.pageYOffset;
      var docHeight = document.body.scrollHeight - window.innerHeight;
      var scrollPercent = Math.round((scrollTop / docHeight) * 100);
      
      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        
        // Track milestone scroll depths
        if (scrollPercent >= 25 && readingProgress < 25) {
          gtag('event', 'scroll_depth', {
            event_category: 'engagement',
            event_label: '25%',
            value: 25,
            custom_parameters: {
              page_title: pageTitle
            }
          });
          readingProgress = 25;
        } else if (scrollPercent >= 50 && readingProgress < 50) {
          gtag('event', 'scroll_depth', {
            event_category: 'engagement',
            event_label: '50%',
            value: 50,
            custom_parameters: {
              page_title: pageTitle
            }
          });
          readingProgress = 50;
        } else if (scrollPercent >= 75 && readingProgress < 75) {
          gtag('event', 'scroll_depth', {
            event_category: 'engagement',
            event_label: '75%',
            value: 75,
            custom_parameters: {
              page_title: pageTitle
            }
          });
          readingProgress = 75;
        } else if (scrollPercent >= 90 && readingProgress < 90) {
          gtag('event', 'scroll_depth', {
            event_category: 'engagement',
            event_label: '90%',
            value: 90,
            custom_parameters: {
              page_title: pageTitle
            }
          });
          readingProgress = 90;
        }
      }
    });

    // Track time spent reading
    var startTime = Date.now();
    var timeOnPage = 0;
    
    // Track every 30 seconds of reading time
    var readingTimer = setInterval(function() {
      if (document.visibilityState === 'visible') {
        timeOnPage += 30;
        gtag('event', 'reading_time', {
          event_category: 'engagement',
          event_label: pageTitle,
          value: timeOnPage
        });
      }
    }, 30000);

    // Track when user leaves the page
    window.addEventListener('beforeunload', function() {
      clearInterval(readingTimer);
      var totalTime = Math.round((Date.now() - startTime) / 1000);
      gtag('event', 'page_exit', {
        event_category: 'engagement',
        event_label: pageTitle,
        value: totalTime
      });
    });
  }

  function trackOutboundLinks() {
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (link && link.hostname !== window.location.hostname) {
        gtag('event', 'click', {
          event_category: 'outbound_link',
          event_label: link.href,
          transport_type: 'beacon'
        });
      }
    });
  }

  function trackSocialClicks() {
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (link) {
        var href = link.href.toLowerCase();
        var platform = '';
        
        if (href.indexOf('twitter.com') !== -1 || href.indexOf('x.com') !== -1) {
          platform = 'twitter';
        } else if (href.indexOf('github.com') !== -1) {
          platform = 'github';
        } else if (href.indexOf('linkedin.com') !== -1) {
          platform = 'linkedin';
        }
        
        if (platform) {
          gtag('event', 'social_click', {
            event_category: 'social_media',
            event_label: platform
          });
        }
      }
    });
  }

})(); 