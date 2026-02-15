/**
 * MajixAI Google Analytics Enhanced Tracking
 * 
 * This module provides enhanced tracking capabilities including:
 * - Page views with engagement metrics
 * - User interactions (clicks, scrolls, time on page)
 * - Project card clicks and navigation
 * - Custom events for PWA installation
 * - Performance metrics
 */

(function() {
    'use strict';

    // Configuration - GA4 Measurement ID should be set via gtag config
    const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with actual Measurement ID in production
    const DEBUG_MODE = false;

    // Session tracking
    let sessionStartTime = Date.now();
    let pageViews = 0;
    let scrollDepthTracked = {};
    let engagementTime = 0;
    let lastActiveTime = Date.now();

    /**
     * Initialize Google Analytics gtag
     */
    function initializeGtag() {
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;
        
        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID, {
            'send_page_view': false, // We'll send custom page views
            'cookie_flags': 'SameSite=None;Secure',
            'anonymize_ip': true
        });

        if (DEBUG_MODE) {
            console.log('[Analytics] gtag initialized with ID:', GA_MEASUREMENT_ID);
        }
    }

    /**
     * Log event to console in debug mode
     */
    function debugLog(eventName, params) {
        if (DEBUG_MODE) {
            console.log(`[Analytics] Event: ${eventName}`, params);
        }
    }

    /**
     * Track enhanced page view with custom dimensions
     */
    function trackPageView() {
        pageViews++;
        const params = {
            page_title: document.title,
            page_location: window.location.href,
            page_path: window.location.pathname,
            page_referrer: document.referrer,
            session_page_views: pageViews,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            color_depth: window.screen.colorDepth,
            is_pwa: window.matchMedia('(display-mode: standalone)').matches ? 'true' : 'false',
            connection_type: navigator.connection ? navigator.connection.effectiveType : 'unknown'
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', params);
        }
        debugLog('page_view', params);
    }

    /**
     * Track scroll depth milestones (25%, 50%, 75%, 100%)
     */
    function trackScrollDepth() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

        const milestones = [25, 50, 75, 100];
        milestones.forEach(milestone => {
            if (scrollPercent >= milestone && !scrollDepthTracked[milestone]) {
                scrollDepthTracked[milestone] = true;
                const params = {
                    scroll_depth: milestone,
                    page_path: window.location.pathname
                };
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'scroll_depth', params);
                }
                debugLog('scroll_depth', params);
            }
        });
    }

    /**
     * Track project card clicks with enhanced data
     */
    function trackProjectClick(projectName, projectPath, projectDesc) {
        const params = {
            event_category: 'engagement',
            event_label: projectName,
            project_name: projectName,
            project_path: projectPath,
            project_description: projectDesc,
            time_to_click: Math.round((Date.now() - sessionStartTime) / 1000),
            page_path: window.location.pathname
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', 'project_click', params);
        }
        debugLog('project_click', params);
    }

    /**
     * Track PWA installation prompt and outcome
     */
    function trackPWAInstall(outcome) {
        const params = {
            event_category: 'pwa',
            event_label: outcome,
            outcome: outcome,
            time_on_page: Math.round((Date.now() - sessionStartTime) / 1000)
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', 'pwa_install', params);
        }
        debugLog('pwa_install', params);
    }

    /**
     * Track user engagement time
     */
    function trackEngagementTime() {
        const now = Date.now();
        engagementTime += now - lastActiveTime;
        lastActiveTime = now;
    }

    /**
     * Track search/filter interactions
     */
    function trackSearch(searchTerm) {
        const params = {
            event_category: 'engagement',
            search_term: searchTerm,
            page_path: window.location.pathname
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', 'search', params);
        }
        debugLog('search', params);
    }

    /**
     * Track custom events
     */
    function trackEvent(eventName, eventParams = {}) {
        const params = {
            ...eventParams,
            page_path: window.location.pathname,
            timestamp: new Date().toISOString()
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, params);
        }
        debugLog(eventName, params);
    }

    /**
     * Track performance metrics using Navigation Timing Level 2 API
     */
    function trackPerformance() {
        if ('performance' in window && 'getEntriesByType' in performance) {
            window.addEventListener('load', function() {
                setTimeout(function() {
                    const entries = performance.getEntriesByType('navigation');
                    if (entries.length > 0) {
                        const navTiming = entries[0];
                        const params = {
                            dns_time: Math.round(navTiming.domainLookupEnd - navTiming.domainLookupStart),
                            connect_time: Math.round(navTiming.connectEnd - navTiming.connectStart),
                            ttfb: Math.round(navTiming.responseStart - navTiming.requestStart),
                            dom_load_time: Math.round(navTiming.domContentLoadedEventEnd - navTiming.startTime),
                            page_load_time: Math.round(navTiming.loadEventEnd - navTiming.startTime)
                        };

                        if (typeof gtag !== 'undefined') {
                            gtag('event', 'page_timing', params);
                        }
                        debugLog('page_timing', params);
                    }
                }, 0);
            });
        }
    }

    /**
     * Track errors
     */
    function trackError(errorMessage, errorSource, errorLine) {
        const safeMessage = String(errorMessage || 'Unknown error').substring(0, 100);
        const params = {
            event_category: 'error',
            error_message: safeMessage,
            error_source: errorSource || 'unknown',
            error_line: errorLine || 0,
            page_path: window.location.pathname
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', 'javascript_error', params);
        }
        debugLog('javascript_error', params);
    }

    /**
     * Send engagement data before page unload
     */
    function trackPageExit() {
        trackEngagementTime();
        const scrollKeys = Object.keys(scrollDepthTracked).map(Number).filter(n => !isNaN(n));
        const maxScroll = scrollKeys.length > 0 ? Math.max(...scrollKeys) : 0;
        const params = {
            event_category: 'engagement',
            engagement_time_msec: engagementTime,
            session_duration: Math.round((Date.now() - sessionStartTime) / 1000),
            max_scroll_depth: maxScroll,
            page_path: window.location.pathname
        };

        // Use sendBeacon for reliable exit tracking
        if (navigator.sendBeacon && typeof gtag !== 'undefined') {
            gtag('event', 'page_exit', params);
        }
        debugLog('page_exit', params);
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Scroll tracking (throttled)
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            if (scrollTimeout) return;
            scrollTimeout = setTimeout(function() {
                trackScrollDepth();
                scrollTimeout = null;
            }, 250);
        }, { passive: true });

        // User activity tracking
        ['click', 'keypress', 'touchstart'].forEach(function(eventType) {
            document.addEventListener(eventType, trackEngagementTime, { passive: true });
        });

        // Project card click tracking
        document.addEventListener('click', function(e) {
            const card = e.target.closest('.project-card');
            if (card) {
                const link = card.querySelector('a');
                if (link) {
                    const title = card.querySelector('.project-title');
                    const desc = card.querySelector('.project-desc');
                    trackProjectClick(
                        title ? title.textContent : 'Unknown',
                        link.getAttribute('href') || 'Unknown',
                        desc ? desc.textContent : ''
                    );
                }
            }
        });

        // Page visibility change
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                trackPageExit();
            } else {
                lastActiveTime = Date.now();
            }
        });

        // Before unload
        window.addEventListener('beforeunload', trackPageExit);

        // Error tracking
        window.addEventListener('error', function(e) {
            trackError(e.message, e.filename, e.lineno);
        });

        // PWA install prompt
        window.addEventListener('beforeinstallprompt', function(e) {
            trackEvent('pwa_install_prompt_shown');
            
            // Store the event for later use
            window.deferredInstallPrompt = e;
        });

        // PWA installed
        window.addEventListener('appinstalled', function() {
            trackPWAInstall('installed');
        });
    }

    /**
     * Initialize analytics
     */
    function init() {
        // Only initialize if not already done
        if (window.majixAnalyticsInitialized) return;
        window.majixAnalyticsInitialized = true;

        initializeGtag();
        trackPageView();
        trackPerformance();
        setupEventListeners();

        // Track if user is returning to installed PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            trackEvent('pwa_session_start', {
                event_category: 'pwa',
                event_label: 'standalone_mode'
            });
        }

        if (DEBUG_MODE) {
            console.log('[Analytics] Enhanced tracking initialized');
        }
    }

    // Export for external use
    window.MajixAnalytics = {
        trackEvent: trackEvent,
        trackSearch: trackSearch,
        trackProjectClick: trackProjectClick,
        trackPWAInstall: trackPWAInstall
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
