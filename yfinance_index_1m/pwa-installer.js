// PWA Installation Manager
let deferredPrompt;
let serviceWorkerRegistration;

// Initialize PWA functionality
async function initPWA() {
    console.log('[PWA] Initializing Progressive Web App features...');
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './'
            });
            console.log('[PWA] Service Worker registered:', serviceWorkerRegistration);
            
            // Check for updates
            serviceWorkerRegistration.addEventListener('updatefound', () => {
                const newWorker = serviceWorkerRegistration.installing;
                console.log('[PWA] New Service Worker found');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateNotification();
                    }
                });
            });
            
            // Handle controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[PWA] Controller changed, reloading page');
                window.location.reload();
            });
            
        } catch (error) {
            console.error('[PWA] Service Worker registration failed:', error);
        }
    }
    
    // Setup install prompt
    setupInstallPrompt();
    
    // Setup offline/online indicators
    setupNetworkIndicators();
    
    // Request notification permission
    requestNotificationPermission();
}

// Setup install prompt handling
function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA] Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show custom install modal after 5 seconds
        setTimeout(() => {
            showPWAInstallModal();
        }, 5000);
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed successfully');
        deferredPrompt = null;
        closePWAModal();
        showToast('✅ App installed successfully!', 'success');
    });
}

// Show PWA install modal
function showPWAInstallModal() {
    const modal = document.getElementById('pwa-install-modal');
    const installBtn = document.getElementById('pwa-install-btn');
    
    if (!modal || !deferredPrompt) return;
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        console.log('[PWA] App already installed');
        return;
    }
    
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pwa-modal-title');
    
    // Handle install button click
    installBtn.onclick = async () => {
        if (!deferredPrompt) {
            showManualInstallInstructions();
            return;
        }
        
        console.log('[PWA] User accepted install prompt');
        deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice:', outcome);
        
        if (outcome === 'accepted') {
            showToast('Installing app...', 'info');
        } else {
            showToast('Installation cancelled', 'warning');
        }
        
        deferredPrompt = null;
        closePWAModal();
    };
}

// Close PWA modal
function closePWAModal() {
    const modal = document.getElementById('pwa-install-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show manual install instructions for browsers that don't support beforeinstallprompt
function showManualInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS && isSafari) {
        instructions = `
            <h3>Install on iOS</h3>
            <ol>
                <li>Tap the Share button <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='16' height='16'%3E%3Cpath d='M18 16v2H6v-2H4v4h16v-4h-2zM17 9l-5-5-5 5h3v6h4V9h3z' fill='%23007AFF'/%3E%3C/svg%3E" style="display:inline; vertical-align:middle;"></li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" in the top right corner</li>
            </ol>
        `;
    } else if (navigator.userAgent.includes('Chrome')) {
        instructions = `
            <h3>Install on Chrome</h3>
            <ol>
                <li>Click the menu (⋮) in the top right</li>
                <li>Select "Install Market Analytics"</li>
                <li>Click "Install" in the popup</li>
            </ol>
        `;
    } else {
        instructions = `
            <h3>Install Instructions</h3>
            <p>Look for an "Install" or "Add to Home Screen" option in your browser's menu.</p>
        `;
    }
    
    const modal = document.getElementById('pwa-install-modal');
    const modalBody = modal.querySelector('.pwa-modal-body');
    modalBody.innerHTML = instructions + '<button onclick="closePWAModal()" class="btn-primary">Got it</button>';
}

// Show update notification
function showUpdateNotification() {
    const notification = document.getElementById('update-notification');
    if (!notification) return;
    
    notification.style.display = 'flex';
    
    document.getElementById('update-btn').onclick = () => {
        if (serviceWorkerRegistration && serviceWorkerRegistration.waiting) {
            serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    };
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 30000);
}

// Setup network indicators
function setupNetworkIndicators() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (!offlineIndicator) return;
    
    function updateOnlineStatus() {
        if (navigator.onLine) {
            offlineIndicator.style.display = 'none';
            console.log('[PWA] Online');
        } else {
            offlineIndicator.style.display = 'flex';
            console.log('[PWA] Offline');
        }
    }
    
    window.addEventListener('online', () => {
        updateOnlineStatus();
        showToast('✅ Back online!', 'success');
    });
    
    window.addEventListener('offline', () => {
        updateOnlineStatus();
        showToast('📡 You are offline', 'warning');
    });
    
    // Initial check
    updateOnlineStatus();
}

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('[PWA] Notifications not supported');
        return;
    }
    
    if (Notification.permission === 'default') {
        // Don't request immediately, wait for user interaction
        console.log('[PWA] Notification permission not yet requested');
    } else if (Notification.permission === 'granted') {
        console.log('[PWA] Notification permission already granted');
        subscribeToPushNotifications();
    } else {
        console.log('[PWA] Notification permission denied');
    }
}

// Subscribe to push notifications
async function subscribeToPushNotifications() {
    if (!serviceWorkerRegistration) {
        console.log('[PWA] Service Worker not registered yet');
        return;
    }
    
    try {
        const subscription = await serviceWorkerRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                'BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrpcPBDo4jQTLfPXlidPPFAHhQ8hEk3i7MRjQRlR-fBhQBjAFJw'
            )
        });
        
        console.log('[PWA] Push subscription:', subscription);
        
        // Send subscription to server
        await sendSubscriptionToServer(subscription);
        
    } catch (error) {
        console.error('[PWA] Push subscription failed:', error);
    }
}

// Convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\\-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Send subscription to server
async function sendSubscriptionToServer(subscription) {
    try {
        const response = await fetch('/api/push-subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription)
        });
        
        if (response.ok) {
            console.log('[PWA] Subscription sent to server');
        }
    } catch (error) {
        console.error('[PWA] Failed to send subscription:', error);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#667eea'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add share functionality
async function shareContent(title, text, url) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url
            });
            console.log('[PWA] Content shared successfully');
        } catch (error) {
            console.error('[PWA] Share failed:', error);
        }
    } else {
        // Fallback to copy to clipboard
        const shareUrl = url || window.location.href;
        await navigator.clipboard.writeText(shareUrl);
        showToast('📋 Link copied to clipboard!', 'success');
    }
}

// Export functions for global use
window.closePWAModal = closePWAModal;
window.shareContent = shareContent;
window.showPWAInstallModal = showPWAInstallModal;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
} else {
    initPWA();
}

console.log('[PWA] Installer script loaded');
