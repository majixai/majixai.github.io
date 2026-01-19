// Enhanced Permissions Manager for YFinance PWA
// Handles notifications, background sync, clipboard, geolocation, and file handling

class PermissionsManager {
    constructor() {
        this.permissions = {
            notifications: false,
            push: false,
            backgroundSync: false,
            clipboard: false,
            geolocation: false,
            periodicSync: false
        };
        
        this.checkPermissions();
    }
    
    async checkPermissions() {
        // Check Notifications
        if ('Notification' in window) {
            this.permissions.notifications = Notification.permission === 'granted';
        }
        
        // Check Background Sync
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            this.permissions.backgroundSync = true;
        }
        
        // Check Periodic Background Sync
        if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
            this.permissions.periodicSync = true;
        }
        
        // Check Clipboard
        if (navigator.clipboard) {
            this.permissions.clipboard = true;
        }
        
        // Check Geolocation
        if ('geolocation' in navigator) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                this.permissions.geolocation = result.state === 'granted';
            } catch (e) {
                console.warn('Geolocation permission check failed:', e);
            }
        }
        
        return this.permissions;
    }
    
    async requestNotifications() {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.permissions.notifications = permission === 'granted';
            
            if (this.permissions.notifications) {
                console.log('✓ Notifications enabled');
                // Show welcome notification
                new Notification('YFinance PWA', {
                    body: 'Notifications enabled! You\'ll receive market updates.',
                    icon: './icons/icon-192x192.png',
                    badge: './icons/icon-96x96.png'
                });
            }
            
            return this.permissions.notifications;
        } catch (error) {
            console.error('Notification request failed:', error);
            return false;
        }
    }
    
    async requestGeolocation() {
        if (!('geolocation' in navigator)) {
            console.warn('Geolocation not supported');
            return false;
        }
        
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.permissions.geolocation = true;
                    console.log('✓ Geolocation enabled:', position.coords);
                    resolve(true);
                },
                (error) => {
                    console.warn('Geolocation denied:', error);
                    resolve(false);
                }
            );
        });
    }
    
    async registerBackgroundSync(tag = 'sync-market-data') {
        if (!this.permissions.backgroundSync) {
            console.warn('Background Sync not supported');
            return false;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register(tag);
            console.log('✓ Background sync registered:', tag);
            return true;
        } catch (error) {
            console.error('Background sync registration failed:', error);
            return false;
        }
    }
    
    async registerPeriodicSync(tag = 'update-market-data', minInterval = 60 * 60 * 1000) {
        if (!this.permissions.periodicSync) {
            console.warn('Periodic Background Sync not supported');
            return false;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.periodicSync.register(tag, {
                minInterval: minInterval // 1 hour
            });
            console.log('✓ Periodic sync registered:', tag);
            return true;
        } catch (error) {
            console.error('Periodic sync registration failed:', error);
            return false;
        }
    }
    
    async copyToClipboard(text) {
        if (!this.permissions.clipboard) {
            console.warn('Clipboard API not available');
            return false;
        }
        
        try {
            await navigator.clipboard.writeText(text);
            console.log('✓ Copied to clipboard');
            return true;
        } catch (error) {
            console.error('Clipboard write failed:', error);
            return false;
        }
    }
    
    async readFromClipboard() {
        if (!this.permissions.clipboard) {
            console.warn('Clipboard API not available');
            return null;
        }
        
        try {
            const text = await navigator.clipboard.readText();
            console.log('✓ Read from clipboard');
            return text;
        } catch (error) {
            console.error('Clipboard read failed:', error);
            return null;
        }
    }
    
    async subscribeToPush() {
        if (!this.permissions.notifications) {
            console.warn('Notifications must be enabled first');
            return null;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Subscribe with VAPID public key (you'll need to generate this)
                const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY_HERE';
                const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
                
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });
                
                console.log('✓ Push subscription created');
            }
            
            return subscription;
        } catch (error) {
            console.error('Push subscription failed:', error);
            return null;
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    
    async shareData(data) {
        if (!navigator.share) {
            console.warn('Web Share API not supported');
            return false;
        }
        
        try {
            await navigator.share(data);
            console.log('✓ Shared successfully');
            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share failed:', error);
            }
            return false;
        }
    }
    
    getStatus() {
        return {
            notifications: this.permissions.notifications ? '✅ Enabled' : '❌ Disabled',
            backgroundSync: this.permissions.backgroundSync ? '✅ Available' : '❌ Not Available',
            periodicSync: this.permissions.periodicSync ? '✅ Available' : '❌ Not Available',
            clipboard: this.permissions.clipboard ? '✅ Available' : '❌ Not Available',
            geolocation: this.permissions.geolocation ? '✅ Enabled' : '❌ Disabled'
        };
    }
    
    showPermissionsUI() {
        const status = this.getStatus();
        const html = `
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="color: #667eea; margin-bottom: 15px;">📋 App Permissions</h3>
                <div style="display: grid; gap: 10px;">
                    <div><strong>Notifications:</strong> ${status.notifications}</div>
                    <div><strong>Background Sync:</strong> ${status.backgroundSync}</div>
                    <div><strong>Periodic Sync:</strong> ${status.periodicSync}</div>
                    <div><strong>Clipboard:</strong> ${status.clipboard}</div>
                    <div><strong>Geolocation:</strong> ${status.geolocation}</div>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="permissionsManager.requestNotifications()" 
                            style="padding: 10px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Enable Notifications
                    </button>
                    <button onclick="permissionsManager.registerBackgroundSync()" 
                            style="padding: 10px 15px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Enable Auto-Sync
                    </button>
                    <button onclick="permissionsManager.requestGeolocation()" 
                            style="padding: 10px 15px; background: #f59e0b; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Enable Location
                    </button>
                </div>
            </div>
        `;
        return html;
    }
}

// Initialize permissions manager
const permissionsManager = new PermissionsManager();

// Auto-request notifications on first load (with delay)
setTimeout(() => {
    if (!permissionsManager.permissions.notifications && 
        localStorage.getItem('notifications-prompt-shown') !== 'true') {
        permissionsManager.requestNotifications();
        localStorage.setItem('notifications-prompt-shown', 'true');
    }
}, 5000);

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PermissionsManager;
}
