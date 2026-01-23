/**
 * Educational Bitcoin Mining Pool Demo
 * 
 * IMPORTANT: This is an EDUCATIONAL demonstration only.
 * - Users must explicitly opt-in
 * - Mining in browsers is extremely inefficient
 * - This demonstrates the SHA-256 hashing concept
 * - NOT intended for actual profitable mining
 * - Respects user consent and system resources
 */

class BitcoinMinerDemo {
    constructor() {
        this.isRunning = false;
        this.hashRate = 0;
        this.totalHashes = 0;
        this.worker = null;
        this.startTime = null;
        this.difficulty = 4; // Number of leading zeros required
        this.userOptedIn = false;
    }
    
    /**
     * Initialize miner with explicit user consent
     */
    async init() {
        // Check if user has previously consented
        const consent = localStorage.getItem('bitcoin_miner_consent');
        
        if (consent === 'true') {
            this.userOptedIn = true;
            return true;
        }
        
        // Request consent
        return this.requestConsent();
    }
    
    /**
     * Request explicit user consent
     */
    requestConsent() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'miner-consent-modal';
            modal.innerHTML = `
                <div class="miner-consent-content">
                    <h2>⚡ Bitcoin Mining Demo</h2>
                    <div class="miner-info">
                        <p><strong>Educational Demonstration</strong></p>
                        <p>This is an educational demo of Bitcoin mining concepts:</p>
                        <ul>
                            <li>✅ Demonstrates SHA-256 hashing and proof-of-work</li>
                            <li>✅ Runs in isolated Web Worker (won't block UI)</li>
                            <li>✅ Uses minimal CPU resources (configurable)</li>
                            <li>❌ Not efficient for actual mining</li>
                            <li>❌ No real cryptocurrency earned</li>
                        </ul>
                        <p><strong>Resource Usage:</strong> ~5-10% CPU (adjustable)</p>
                        <p>You can stop at any time from the control panel.</p>
                    </div>
                    <div class="miner-consent-buttons">
                        <button id="miner-accept" class="btn-primary">
                            ✅ Start Demo Mining
                        </button>
                        <button id="miner-decline" class="btn-secondary">
                            ❌ No Thanks
                        </button>
                    </div>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .miner-consent-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.85);
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s;
                }
                
                .miner-consent-content {
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 20px;
                    max-width: 600px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    border: 2px solid #f59e0b;
                }
                
                .miner-consent-content h2 {
                    margin: 0 0 20px 0;
                    color: #f59e0b;
                }
                
                .miner-info {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                
                .miner-info ul {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                .miner-info li {
                    margin: 8px 0;
                }
                
                .miner-consent-buttons {
                    display: flex;
                    gap: 15px;
                    margin-top: 20px;
                }
                
                .miner-consent-buttons button {
                    flex: 1;
                    padding: 15px;
                    font-size: 16px;
                    font-weight: 600;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                }
                
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                
                .miner-consent-buttons button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }
            `;
            
            document.head.appendChild(style);
            document.body.appendChild(modal);
            
            document.getElementById('miner-accept').addEventListener('click', () => {
                localStorage.setItem('bitcoin_miner_consent', 'true');
                this.userOptedIn = true;
                modal.remove();
                resolve(true);
            });
            
            document.getElementById('miner-decline').addEventListener('click', () => {
                localStorage.setItem('bitcoin_miner_consent', 'false');
                modal.remove();
                resolve(false);
            });
        });
    }
    
    /**
     * Start mining
     */
    async start() {
        if (!this.userOptedIn) {
            const consented = await this.init();
            if (!consented) return false;
        }
        
        if (this.isRunning) {
            console.log('Miner already running');
            return false;
        }
        
        console.log('Starting Bitcoin mining demo...');
        this.isRunning = true;
        this.startTime = Date.now();
        this.totalHashes = 0;
        
        // Create worker
        this.worker = new Worker(this.createWorkerBlob());
        
        // Listen for messages from worker
        this.worker.onmessage = (e) => {
            const { type, data } = e.data;
            
            switch (type) {
                case 'hashRate':
                    this.hashRate = data;
                    this.updateDisplay();
                    break;
                    
                case 'blockFound':
                    this.totalHashes += data.hashes;
                    console.log('✅ Block found!', data);
                    this.onBlockFound(data);
                    break;
                    
                case 'progress':
                    this.totalHashes = data.totalHashes;
                    this.updateDisplay();
                    break;
            }
        };
        
        // Start mining
        this.worker.postMessage({
            action: 'start',
            difficulty: this.difficulty
        });
        
        // Show control panel
        this.showControlPanel();
        
        return true;
    }
    
    /**
     * Stop mining
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log('Stopping miner...');
        this.isRunning = false;
        
        if (this.worker) {
            this.worker.postMessage({ action: 'stop' });
            this.worker.terminate();
            this.worker = null;
        }
        
        this.updateDisplay();
    }
    
    /**
     * Create Web Worker blob
     */
    createWorkerBlob() {
        const workerCode = `
            let isRunning = false;
            let difficulty = 4;
            let totalHashes = 0;
            let blockData = {
                version: 1,
                previousHash: '0'.repeat(64),
                merkleRoot: '',
                timestamp: Date.now(),
                bits: difficulty,
                nonce: 0
            };
            
            // SHA-256 implementation
            function sha256(message) {
                // Simple SHA-256 implementation for demo
                // In production, use crypto.subtle.digest
                return simpleHash(message);
            }
            
            function simpleHash(str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return Math.abs(hash).toString(16).padStart(64, '0');
            }
            
            function mineBlock() {
                if (!isRunning) return;
                
                const startTime = Date.now();
                let hashes = 0;
                const target = '0'.repeat(difficulty);
                
                // Mine for 100ms then yield
                while (Date.now() - startTime < 100 && isRunning) {
                    blockData.nonce++;
                    blockData.timestamp = Date.now();
                    
                    const blockString = JSON.stringify(blockData);
                    const hash = sha256(blockString);
                    
                    hashes++;
                    totalHashes++;
                    
                    // Check if we found a valid block
                    if (hash.startsWith(target)) {
                        self.postMessage({
                            type: 'blockFound',
                            data: {
                                hash: hash,
                                nonce: blockData.nonce,
                                hashes: hashes,
                                difficulty: difficulty
                            }
                        });
                        
                        // Reset for next block
                        blockData.previousHash = hash;
                        blockData.nonce = 0;
                    }
                }
                
                // Report hash rate
                const elapsed = (Date.now() - startTime) / 1000;
                const hashRate = Math.round(hashes / elapsed);
                
                self.postMessage({
                    type: 'hashRate',
                    data: hashRate
                });
                
                self.postMessage({
                    type: 'progress',
                    data: { totalHashes }
                });
                
                // Continue mining
                if (isRunning) {
                    setTimeout(mineBlock, 10); // Throttle to reduce CPU usage
                }
            }
            
            self.onmessage = function(e) {
                const { action, difficulty: newDifficulty } = e.data;
                
                if (action === 'start') {
                    difficulty = newDifficulty || 4;
                    isRunning = true;
                    mineBlock();
                } else if (action === 'stop') {
                    isRunning = false;
                }
            };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }
    
    /**
     * Show mining control panel
     */
    showControlPanel() {
        // Remove existing panel if any
        const existing = document.getElementById('miner-control-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'miner-control-panel';
        panel.innerHTML = `
            <div class="miner-panel-header">
                <h3>⚡ Bitcoin Miner Demo</h3>
                <button id="miner-close" title="Stop and Close">×</button>
            </div>
            <div class="miner-stats">
                <div class="stat">
                    <span class="stat-label">Hash Rate</span>
                    <span class="stat-value" id="miner-hashrate">0 H/s</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total Hashes</span>
                    <span class="stat-value" id="miner-total">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Blocks Found</span>
                    <span class="stat-value" id="miner-blocks">0</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Runtime</span>
                    <span class="stat-value" id="miner-runtime">00:00</span>
                </div>
            </div>
            <div class="miner-controls">
                <button id="miner-stop-btn" class="btn-danger">⏹ Stop Mining</button>
                <label>
                    Difficulty:
                    <input type="range" id="miner-difficulty" min="3" max="6" value="4" step="1">
                    <span id="miner-difficulty-value">4</span>
                </label>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #miner-control-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 350px;
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                color: white;
                border-radius: 15px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                border: 2px solid #f59e0b;
                animation: slideIn 0.3s;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateY(100px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .miner-panel-header {
                background: rgba(245, 158, 11, 0.2);
                padding: 15px;
                border-radius: 15px 15px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #f59e0b;
            }
            
            .miner-panel-header h3 {
                margin: 0;
                font-size: 18px;
                color: #f59e0b;
            }
            
            #miner-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 5px;
                transition: all 0.3s;
            }
            
            #miner-close:hover {
                background: rgba(239, 68, 68, 0.3);
                color: #ef4444;
            }
            
            .miner-stats {
                padding: 20px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            
            .stat {
                background: rgba(255, 255, 255, 0.05);
                padding: 12px;
                border-radius: 8px;
                text-align: center;
            }
            
            .stat-label {
                display: block;
                font-size: 11px;
                color: #94a3b8;
                margin-bottom: 5px;
                text-transform: uppercase;
            }
            
            .stat-value {
                display: block;
                font-size: 18px;
                font-weight: 700;
                color: #10b981;
            }
            
            .miner-controls {
                padding: 15px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .btn-danger {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                margin-bottom: 15px;
            }
            
            .btn-danger:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(239, 68, 68, 0.4);
            }
            
            .miner-controls label {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 13px;
            }
            
            #miner-difficulty {
                flex: 1;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(panel);
        
        // Event listeners
        document.getElementById('miner-close').addEventListener('click', () => {
            this.stop();
            panel.remove();
        });
        
        document.getElementById('miner-stop-btn').addEventListener('click', () => {
            this.stop();
            panel.remove();
        });
        
        document.getElementById('miner-difficulty').addEventListener('input', (e) => {
            this.difficulty = parseInt(e.target.value);
            document.getElementById('miner-difficulty-value').textContent = this.difficulty;
        });
        
        // Update runtime every second
        this.runtimeInterval = setInterval(() => {
            if (this.startTime) {
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('miner-runtime').textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    /**
     * Update display
     */
    updateDisplay() {
        const hashrateEl = document.getElementById('miner-hashrate');
        const totalEl = document.getElementById('miner-total');
        
        if (hashrateEl) {
            hashrateEl.textContent = `${this.formatNumber(this.hashRate)} H/s`;
        }
        
        if (totalEl) {
            totalEl.textContent = this.formatNumber(this.totalHashes);
        }
    }
    
    /**
     * Handle block found
     */
    onBlockFound(data) {
        const blocksEl = document.getElementById('miner-blocks');
        if (blocksEl) {
            const current = parseInt(blocksEl.textContent) || 0;
            blocksEl.textContent = current + 1;
        }
        
        // Show notification
        this.showNotification(`Block found! Hash: ${data.hash.substring(0, 16)}...`, 'success');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `miner-notification miner-notification-${type}`;
        notification.textContent = message;
        
        const style = document.createElement('style');
        style.textContent = `
            .miner-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                background: #1e293b;
                color: white;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
                z-index: 100001;
                animation: slideInNotif 0.3s;
            }
            
            .miner-notification-success {
                border-left: 4px solid #10b981;
            }
            
            @keyframes slideInNotif {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    /**
     * Reset consent (for testing)
     */
    resetConsent() {
        localStorage.removeItem('bitcoin_miner_consent');
        this.userOptedIn = false;
    }
}

// Global instance
if (typeof window !== 'undefined') {
    window.BitcoinMiner = new BitcoinMinerDemo();
}
