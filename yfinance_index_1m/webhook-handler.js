// Webhook Handler for Real-time Updates
class WebhookManager {
    constructor() {
        this.wsConnection = null;
        this.webhookEndpoints = [];
        this.retryAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000;
        this.isConnected = false;
        this.eventListeners = new Map();
        this.messageQueue = [];
    }

    // Initialize webhook connections
    async initialize() {
        console.log('[Webhook] Initializing webhook manager...');
        
        // Setup WebSocket connection
        this.setupWebSocket();
        
        // Setup Server-Sent Events fallback
        this.setupSSE();
        
        // Setup polling fallback
        this.setupPolling();
        
        // Register webhook endpoints
        this.registerWebhooks();
    }

    // Setup WebSocket connection
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/market-data`;
        
        try {
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('[Webhook] WebSocket connected');
                this.isConnected = true;
                this.retryAttempts = 0;
                this.updateStatus('connected', 'Connected to live updates');
                
                // Send queued messages
                this.flushMessageQueue();
                
                // Send initial subscription
                this.subscribe(['market-data', 'options-data', 'alerts']);
            };
            
            this.wsConnection.onmessage = (event) => {
                this.handleWebSocketMessage(event.data);
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('[Webhook] WebSocket error:', error);
                this.updateStatus('error', 'Connection error');
            };
            
            this.wsConnection.onclose = () => {
                console.log('[Webhook] WebSocket closed');
                this.isConnected = false;
                this.updateStatus('disconnected', 'Disconnected');
                this.reconnectWebSocket();
            };
            
        } catch (error) {
            console.error('[Webhook] WebSocket setup failed:', error);
            this.updateStatus('error', 'WebSocket not available');
        }
    }

    // Reconnect WebSocket with exponential backoff
    reconnectWebSocket() {
        if (this.retryAttempts >= this.maxRetries) {
            console.log('[Webhook] Max retries reached, falling back to SSE/polling');
            this.updateStatus('fallback', 'Using fallback connection');
            return;
        }
        
        const delay = this.retryDelay * Math.pow(2, this.retryAttempts);
        this.retryAttempts++;
        
        console.log(`[Webhook] Reconnecting in ${delay}ms (attempt ${this.retryAttempts})`);
        this.updateStatus('reconnecting', `Reconnecting... (${this.retryAttempts}/${this.maxRetries})`);
        
        setTimeout(() => {
            this.setupWebSocket();
        }, delay);
    }

    // Handle WebSocket messages
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('[Webhook] Message received:', message.type);
            
            // Emit event to listeners
            this.emit(message.type, message.data);
            
            // Handle specific message types
            switch (message.type) {
                case 'market-update':
                    this.handleMarketUpdate(message.data);
                    break;
                case 'price-alert':
                    this.handlePriceAlert(message.data);
                    break;
                case 'options-update':
                    this.handleOptionsUpdate(message.data);
                    break;
                case 'system-notification':
                    this.handleSystemNotification(message.data);
                    break;
                default:
                    console.log('[Webhook] Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('[Webhook] Failed to parse message:', error);
        }
    }

    // Subscribe to specific channels
    subscribe(channels) {
        const message = {
            type: 'subscribe',
            channels: channels,
            timestamp: Date.now()
        };
        
        this.send(message);
    }

    // Send message through WebSocket
    send(message) {
        if (this.isConnected && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify(message));
        } else {
            // Queue message for later
            this.messageQueue.push(message);
            console.log('[Webhook] Message queued:', message.type);
        }
    }

    // Flush message queue
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    // Setup Server-Sent Events (SSE) fallback
    setupSSE() {
        if (!window.EventSource) {
            console.log('[Webhook] SSE not supported');
            return;
        }
        
        try {
            const sseUrl = '/api/events/market-data';
            const eventSource = new EventSource(sseUrl);
            
            eventSource.onopen = () => {
                console.log('[Webhook] SSE connected');
            };
            
            eventSource.onmessage = (event) => {
                this.handleWebSocketMessage(event.data);
            };
            
            eventSource.onerror = (error) => {
                console.error('[Webhook] SSE error:', error);
                eventSource.close();
            };
            
        } catch (error) {
            console.error('[Webhook] SSE setup failed:', error);
        }
    }

    // Setup polling fallback
    setupPolling() {
        // Poll every 30 seconds as last resort
        setInterval(async () => {
            if (!this.isConnected) {
                await this.pollForUpdates();
            }
        }, 30000);
    }

    // Poll for updates
    async pollForUpdates() {
        try {
            const response = await fetch('/api/market-data/latest', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.emit('market-update', data);
            }
        } catch (error) {
            console.error('[Webhook] Polling failed:', error);
        }
    }

    // Register webhook endpoints
    registerWebhooks() {
        this.webhookEndpoints = [
            {
                name: 'market-data',
                url: '/api/webhooks/market-data',
                method: 'POST',
                events: ['price-update', 'volume-update']
            },
            {
                name: 'options-data',
                url: '/api/webhooks/options',
                method: 'POST',
                events: ['iv-update', 'greeks-update']
            },
            {
                name: 'alerts',
                url: '/api/webhooks/alerts',
                method: 'POST',
                events: ['price-alert', 'volatility-alert']
            }
        ];
        
        console.log('[Webhook] Registered endpoints:', this.webhookEndpoints.length);
    }

    // Handle market update
    handleMarketUpdate(data) {
        console.log('[Webhook] Market update received:', data);
        
        // Update UI with new data
        if (window.updateMarketData) {
            window.updateMarketData(data);
        }
        
        // Show notification if significant change
        if (data.changePercent && Math.abs(data.changePercent) > 2) {
            this.showNotification(
                'Market Alert',
                `${data.symbol}: ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`
            );
        }
    }

    // Handle price alert
    handlePriceAlert(data) {
        console.log('[Webhook] Price alert:', data);
        
        this.showNotification(
            '🚨 Price Alert',
            `${data.symbol} has ${data.direction === 'up' ? 'risen' : 'fallen'} to ${data.price}`,
            {
                requireInteraction: true,
                actions: [
                    { action: 'view', title: 'View Chart' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            }
        );
    }

    // Handle options update
    handleOptionsUpdate(data) {
        console.log('[Webhook] Options update:', data);
        
        // Update options data if visible
        if (window.updateOptionsData) {
            window.updateOptionsData(data);
        }
    }

    // Handle system notification
    handleSystemNotification(data) {
        console.log('[Webhook] System notification:', data);
        
        this.showNotification(
            data.title || 'System Notification',
            data.message,
            { icon: '/icons/icon-192x192.png' }
        );
    }

    // Show notification
    async showNotification(title, body, options = {}) {
        if (!('Notification' in window)) {
            console.log('[Webhook] Notifications not supported');
            return;
        }
        
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: options.icon || '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                vibrate: options.vibrate || [200, 100, 200],
                requireInteraction: options.requireInteraction || false,
                actions: options.actions || [],
                data: options.data || {}
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } else if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.showNotification(title, body, options);
            }
        }
    }

    // Update webhook status indicator
    updateStatus(status, message) {
        const statusElement = document.getElementById('webhook-status');
        const textElement = document.getElementById('webhook-text');
        
        if (!statusElement || !textElement) return;
        
        const statusConfig = {
            connected: { icon: '✅', color: '#28a745', display: true },
            disconnected: { icon: '⭕', color: '#dc3545', display: true },
            reconnecting: { icon: '🔄', color: '#ffc107', display: true },
            error: { icon: '❌', color: '#dc3545', display: true },
            fallback: { icon: '🔀', color: '#17a2b8', display: true }
        };
        
        const config = statusConfig[status] || statusConfig.disconnected;
        
        statusElement.querySelector('.webhook-icon').textContent = config.icon;
        statusElement.style.background = config.color;
        textElement.textContent = message;
        
        if (config.display) {
            statusElement.style.display = 'flex';
            // Auto-hide success messages
            if (status === 'connected') {
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 5000);
            }
        } else {
            statusElement.style.display = 'none';
        }
    }

    // Event emitter pattern
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[Webhook] Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const callbacks = this.eventListeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // Cleanup
    destroy() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        this.eventListeners.clear();
        this.messageQueue = [];
    }
}

// Create global webhook manager instance
const webhookManager = new WebhookManager();

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        webhookManager.initialize();
    });
} else {
    webhookManager.initialize();
}

// Export for global use
window.webhookManager = webhookManager;

console.log('[Webhook] Handler script loaded');
