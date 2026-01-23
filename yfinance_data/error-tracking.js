/**
 * Advanced Error Tracking & Client State Management System
 * Tracks errors, client sessions, and provides debugging capabilities
 */

const ErrorTracker = {
    errors: [],
    maxErrors: 100,
    sessionId: null,
    clientHash: null,
    startTime: Date.now(),
    
    /**
     * Initialize error tracking system
     */
    init() {
        console.log('🔍 Initializing Error Tracking System...');
        
        // Generate unique session ID
        this.sessionId = this.generateSessionId();
        
        // Generate client hash from browser fingerprint
        this.clientHash = this.generateClientHash();
        
        // Store in localStorage
        this.loadStoredErrors();
        
        // Capture all errors
        this.setupErrorListeners();
        
        // Track page load
        this.logEvent('page_load', {
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent
        });
        
        console.log(`✓ Error Tracker initialized - Session: ${this.sessionId}, Client: ${this.clientHash}`);
    },
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${timestamp}-${random}`;
    },
    
    /**
     * Generate client hash from browser fingerprint
     */
    generateClientHash() {
        const fingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            plugins: Array.from(navigator.plugins || []).map(p => p.name).join(','),
            canvas: this.getCanvasFingerprint()
        };
        
        const fingerprintString = JSON.stringify(fingerprint);
        return this.hashString(fingerprintString);
    },
    
    /**
     * Get canvas fingerprint for client identification
     */
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Browser Fingerprint', 2, 2);
            return canvas.toDataURL().substring(0, 50);
        } catch (e) {
            return 'canvas-unavailable';
        }
    },
    
    /**
     * Hash string using simple hash algorithm
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    },
    
    /**
     * Setup global error listeners
     */
    setupErrorListeners() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null
            });
        });
        
        // Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'promise_rejection',
                message: event.reason ? event.reason.toString() : 'Unhandled Promise Rejection',
                reason: event.reason
            });
        });
        
        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.logError({
                    type: 'resource',
                    message: `Failed to load: ${event.target.src || event.target.href}`,
                    element: event.target.tagName
                });
            }
        }, true);
        
        // Console errors (override console.error)
        const originalConsoleError = console.error;
        console.error = (...args) => {
            this.logError({
                type: 'console',
                message: args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                ).join(' ')
            });
            originalConsoleError.apply(console, args);
        };
    },
    
    /**
     * Log an error
     */
    logError(errorData) {
        const error = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            clientHash: this.clientHash,
            url: window.location.href,
            ...errorData
        };
        
        this.errors.unshift(error);
        
        // Keep only last N errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
        
        // Store in localStorage
        this.saveErrors();
        
        // Update UI if error panel exists
        this.updateErrorPanel();
        
        // Log to server if available
        this.sendErrorToServer(error);
        
        console.warn('❌ Error tracked:', error);
    },
    
    /**
     * Log a general event
     */
    logEvent(eventType, data) {
        const event = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            clientHash: this.clientHash,
            type: 'event',
            eventType,
            data
        };
        
        this.errors.unshift(event);
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
        
        this.saveErrors();
        console.log('📊 Event tracked:', eventType, data);
    },
    
    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    },
    
    /**
     * Save errors to localStorage
     */
    saveErrors() {
        try {
            localStorage.setItem('error_tracker_errors', JSON.stringify(this.errors));
            localStorage.setItem('error_tracker_session', this.sessionId);
            localStorage.setItem('error_tracker_client', this.clientHash);
        } catch (e) {
            console.warn('Failed to save errors to localStorage:', e);
        }
    },
    
    /**
     * Load stored errors from localStorage
     */
    loadStoredErrors() {
        try {
            const stored = localStorage.getItem('error_tracker_errors');
            if (stored) {
                this.errors = JSON.parse(stored);
                console.log(`📂 Loaded ${this.errors.length} stored errors`);
            }
        } catch (e) {
            console.warn('Failed to load stored errors:', e);
        }
    },
    
    /**
     * Send error to server for logging
     */
    async sendErrorToServer(error) {
        try {
            // Try to send to error logging endpoint
            await fetch('/log-error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(error)
            });
        } catch (e) {
            // Server logging failed, that's okay
            console.log('Could not send error to server (expected if endpoint not available)');
        }
    },
    
    /**
     * Get all errors as text
     */
    getErrorsAsText() {
        let text = '=== ERROR TRACKING REPORT ===\n\n';
        text += `Session ID: ${this.sessionId}\n`;
        text += `Client Hash: ${this.clientHash}\n`;
        text += `Session Duration: ${((Date.now() - this.startTime) / 1000 / 60).toFixed(2)} minutes\n`;
        text += `Total Errors: ${this.errors.filter(e => e.type !== 'event').length}\n`;
        text += `Total Events: ${this.errors.filter(e => e.type === 'event').length}\n`;
        text += `\n${'='.repeat(50)}\n\n`;
        
        this.errors.forEach((error, index) => {
            text += `[${index + 1}] ${error.timestamp}\n`;
            text += `ID: ${error.id}\n`;
            text += `Type: ${error.type}\n`;
            
            if (error.eventType) {
                text += `Event: ${error.eventType}\n`;
            }
            
            if (error.message) {
                text += `Message: ${error.message}\n`;
            }
            
            if (error.filename) {
                text += `File: ${error.filename}:${error.lineno}:${error.colno}\n`;
            }
            
            if (error.stack) {
                text += `Stack:\n${error.stack}\n`;
            }
            
            if (error.data) {
                text += `Data: ${JSON.stringify(error.data, null, 2)}\n`;
            }
            
            text += `URL: ${error.url}\n`;
            text += `\n${'-'.repeat(50)}\n\n`;
        });
        
        text += `\n=== SYSTEM INFORMATION ===\n\n`;
        text += `User Agent: ${navigator.userAgent}\n`;
        text += `Platform: ${navigator.platform}\n`;
        text += `Language: ${navigator.language}\n`;
        text += `Screen: ${screen.width}x${screen.height}\n`;
        text += `Viewport: ${window.innerWidth}x${window.innerHeight}\n`;
        text += `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`;
        
        return text;
    },
    
    /**
     * Copy errors to clipboard
     */
    async copyToClipboard() {
        const text = this.getErrorsAsText();
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback method
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    },
    
    /**
     * Export errors as downloadable file
     */
    exportToFile() {
        const text = this.getErrorsAsText();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-log-${this.sessionId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors = [];
        this.saveErrors();
        this.updateErrorPanel();
    },
    
    /**
     * Update error panel UI
     */
    updateErrorPanel() {
        const panel = document.getElementById('error-tracker-panel');
        if (!panel) return;
        
        const errorCount = this.errors.filter(e => e.type !== 'event').length;
        const badge = document.getElementById('error-count-badge');
        if (badge) {
            badge.textContent = errorCount;
            badge.style.display = errorCount > 0 ? 'inline-block' : 'none';
        }
        
        const list = document.getElementById('error-list');
        if (list) {
            list.innerHTML = '';
            
            this.errors.slice(0, 20).forEach(error => {
                const item = document.createElement('div');
                item.className = 'error-item';
                item.style.cssText = `
                    padding: 10px;
                    margin: 5px 0;
                    background: ${error.type === 'event' ? '#e3f2fd' : '#ffebee'};
                    border-left: 4px solid ${error.type === 'event' ? '#2196f3' : '#f44336'};
                    border-radius: 4px;
                    font-size: 12px;
                `;
                
                const time = new Date(error.timestamp).toLocaleTimeString();
                const icon = error.type === 'event' ? '📊' : '❌';
                
                item.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 4px;">
                        ${icon} ${time} - ${error.type}
                    </div>
                    <div style="color: #666;">
                        ${error.message || error.eventType || 'No message'}
                    </div>
                `;
                
                list.appendChild(item);
            });
        }
    }
};

// Export for global use
if (typeof window !== 'undefined') {
    window.ErrorTracker = ErrorTracker;
}
