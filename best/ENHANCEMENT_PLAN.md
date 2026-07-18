# JINX v6.0+ Enhancement Plan: Beta Directory Engines
## Tracking Interface & Data Architecture Optimization

**Last Updated:** 2026-07-18  
**Target Release:** v6.1 (Q3 2026)

---

## Executive Summary

The `best/` directory contains three evolutionary tiers of the JINX performer tracking system:
- **Alpha:** Single-module baseline with basic filtering
- **Beta:** Modular architecture with EventBus and storage abstraction
- **Gamma:** Full-featured with neural scoring, retry logic, and structured logging

This document outlines systematic enhancements across all tiers focusing on:
1. **Tracking Interface Data Models** — Unified schema for performer metrics
2. **Real-time State Management** — Optimized synchronization across modules
3. **Caching & Compression** — Reduce bandwidth and improve load times
4. **Analytics Pipeline** — Track user interactions and performer trends
5. **Performance Bottlenecks** — Worker threads, lazy loading, pagination

---

## Part 1: Enhanced Tracking Interface Data Models

### 1.1 Core Performer Tracking Schema

```typescript
// best/shared/types.ts (NEW)
interface PerformerTrackingEvent {
  timestamp: number;
  performerId: string;
  eventType: 'VIEW' | 'FAVORITE' | 'HIDE' | 'NOTE_ADD' | 'MODAL_OPEN' | 'IMAGE_LOAD' | 'TAG_CLICK';
  metadata: {
    imageName?: string;
    imageLoadTime?: number;
    sessionDuration?: number;
    tagApplied?: string;
    noteLength?: number;
  };
  userAgent?: string;
  sessionId: string;
}

interface PerformerMetrics {
  performerId: string;
  username: string;
  
  // Click-through analytics
  viewCount: number;
  lastViewedAt: number;
  averageViewDuration: number;
  
  // Engagement tracking
  isFavorite: boolean;
  favoriteAddedAt: number;
  isHidden: boolean;
  hasNote: boolean;
  
  // Image history
  totalImagesTracked: number;
  imageLoadFailures: number;
  averageImageLoadTime: number;
  
  // Scoring & ranking
  bayesianScore: number;
  trendingScore: number;
  userInterestScore: number;
  
  // Demographic data
  age: number;
  birthday: string; // MM-DD format
  lastOnline: number; // timestamp
  currentViewerCount: number;
  
  // Tags & categorization
  tags: string[];
  aiGeneratedTags?: string[];
  userCustomTags?: string[];
  
  // Behavioral predictions
  predictionNextOnline?: number; // timestamp
  churnRisk?: number; // 0-1 probability
}

interface SessionState {
  sessionId: string;
  startedAt: number;
  isActive: boolean;
  performersViewed: string[];
  totalEventsLogged: number;
  lastActivityAt: number;
  filterState: FilterSnapshot;
  sortAlgorithm: string;
}

interface PerformerImageMetadata {
  imageId: string;
  imageUrl: string;
  downloadedAt: number;
  fileSize: number;
  checksum: string;
  compressedSize: number;
  compressionRatio: number;
  loadTimeMs: number;
  failureCount: number;
  isCached: boolean;
}
```

### 1.2 Enhanced Storage Layer

```javascript
// best/shared/storage-manager.ts (ENHANCED)
class StorageManager {
  constructor(storageType = 'indexeddb') {
    this.storageType = storageType;
    this.db = null;
    this.transactionCache = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    if (this.storageType === 'indexeddb') {
      this.db = await this.openIndexedDB();
      await this.createOptimizedSchemas();
    }
    this.isInitialized = true;
  }

  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JinxTracking', 3); // Version 3 for new schema
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Object stores with indices
        if (!db.objectStoreNames.contains('performers')) {
          const performerStore = db.createObjectStore('performers', { keyPath: 'performerId' });
          performerStore.createIndex('username', 'username', { unique: true });
          performerStore.createIndex('bayesianScore', 'bayesianScore', { unique: false });
          performerStore.createIndex('lastViewedAt', 'lastViewedAt', { unique: false });
          performerStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('trackingEvents')) {
          const eventStore = db.createObjectStore('trackingEvents', { autoIncrement: true });
          eventStore.createIndex('performerId', 'performerId', { unique: false });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventStore.createIndex('sessionId', 'sessionId', { unique: false });
          eventStore.createIndex('eventType', 'eventType', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('imageMetadata')) {
          const imageStore = db.createObjectStore('imageMetadata', { keyPath: 'imageId' });
          imageStore.createIndex('performerId', 'performerId', { unique: false });
          imageStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
          sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async logTrackingEvent(event) {
    const tx = this.db.transaction('trackingEvents', 'readwrite');
    const store = tx.objectStore('trackingEvents');
    
    return new Promise((resolve, reject) => {
      const request = store.add(event);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPerformerMetrics(performerId) {
    const tx = this.db.transaction('performers', 'readonly');
    const store = tx.objectStore('performers');
    
    return new Promise((resolve, reject) => {
      const request = store.get(performerId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePerformerMetrics(performerId, updates) {
    const current = await this.getPerformerMetrics(performerId);
    const updated = { ...current, ...updates, lastModifiedAt: Date.now() };
    
    const tx = this.db.transaction('performers', 'readwrite');
    const store = tx.objectStore('performers');
    
    return new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async queryTrackingEvents(filter = {}) {
    const { performerId, eventType, startTime, endTime, limit = 1000 } = filter;
    const tx = this.db.transaction('trackingEvents', 'readonly');
    const store = tx.objectStore('trackingEvents');
    
    let range = null;
    if (startTime && endTime) {
      range = IDBKeyRange.bound(startTime, endTime);
    }
    
    const index = eventType ? store.index('eventType') : store.index('timestamp');
    const results = [];
    
    return new Promise((resolve, reject) => {
      const request = range ? index.openCursor(range) : index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          const data = cursor.value;
          if (!performerId || data.performerId === performerId) {
            results.push(data);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async exportAnalytics(format = 'json') {
    const performers = await this.getAllPerformers();
    const events = await this.queryTrackingEvents({ limit: 10000 });
    
    const analytics = {
      exportedAt: new Date().toISOString(),
      performerCount: performers.length,
      eventCount: events.length,
      topPerformers: this.computeTopPerformers(performers),
      eventBreakdown: this.analyzeEventTypes(events),
      data: { performers, events }
    };
    
    if (format === 'csv') {
      return this.convertToCSV(analytics);
    }
    return JSON.stringify(analytics, null, 2);
  }
}
```

---

## Part 2: Real-Time State Management Enhancement

### 2.1 Unified State Machine

```javascript
// best/shared/state-engine.ts (NEW)
class JinxStateEngine {
  constructor() {
    this.state = {
      performers: new Map(),
      filteredPerformers: [],
      selectedPerformers: new Set(),
      currentPage: 0,
      sortAlgorithm: 'bayesian',
      isLoading: false,
      syncInProgress: false,
      lastSyncAt: null,
      globalMetrics: {
        mean: 0,
        variance: 0,
        totalEvents: 0
      }
    };
    
    this.subscribers = new Map();
    this.transactionQueue = [];
    this.batchTimeout = null;
    this.BATCH_SIZE = 50;
    this.BATCH_DELAY = 100; // ms
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
    
    return () => {
      const callbacks = this.subscribers.get(event);
      callbacks.splice(callbacks.indexOf(callback), 1);
    };
  }

  emit(event, data) {
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Event handler error for ${event}:`, err);
        }
      });
    }
  }

  batchUpdate(updates) {
    this.transactionQueue.push(...updates);
    
    clearTimeout(this.batchTimeout);
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY);
  }

  flushBatch() {
    if (this.transactionQueue.length === 0) return;
    
    const batch = this.transactionQueue.splice(0, this.BATCH_SIZE);
    batch.forEach(update => {
      const { type, performerId, data } = update;
      
      if (type === 'update') {
        const current = this.state.performers.get(performerId) || {};
        this.state.performers.set(performerId, { ...current, ...data });
      }
    });
    
    this.emit('state:updated', { batchSize: batch.length });
    
    if (this.transactionQueue.length > 0) {
      this.batchTimeout = setTimeout(() => this.flushBatch(), this.BATCH_DELAY);
    }
  }

  getTopPerformers(count = 10, sortBy = 'bayesianScore') {
    return Array.from(this.state.performers.values())
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, count);
  }

  computeGlobalMetrics() {
    const scores = Array.from(this.state.performers.values()).map(p => p.bayesianScore || 0);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = Math.sqrt(
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    );
    
    this.state.globalMetrics = { mean, variance, totalEvents: this.state.performers.size };
    this.emit('metrics:computed', this.state.globalMetrics);
  }
}
```

### 2.2 Event Bus Architecture

```javascript
// best/shared/event-bus.ts (ENHANCED)
class EventBus {
  constructor() {
    this.events = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 500;
  }

  on(eventName, handler, priority = 0) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    
    const handlers = this.events.get(eventName);
    handlers.push({ handler, priority });
    handlers.sort((a, b) => b.priority - a.priority);
    
    return () => {
      const idx = handlers.findIndex(h => h.handler === handler);
      if (idx > -1) handlers.splice(idx, 1);
    };
  }

  emit(eventName, data) {
    this.recordEvent(eventName, data);
    
    if (this.events.has(eventName)) {
      const handlers = this.events.get(eventName);
      for (const { handler } of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Handler error for ${eventName}:`, err);
        }
      }
    }
  }

  recordEvent(eventName, data) {
    this.eventHistory.push({
      eventName,
      timestamp: Date.now(),
      data
    });
    
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getEventHistory(eventName = null) {
    return eventName
      ? this.eventHistory.filter(e => e.eventName === eventName)
      : this.eventHistory;
  }
}
```

---

## Part 3: Caching & Compression Optimization

### 3.1 Smart Image Caching

```javascript
// best/shared/image-cache.ts (ENHANCED)
class ImageCacheManager {
  constructor() {
    this.cache = new Map();
    this.pendingLoads = new Map();
    this.compressionRatios = new Map();
    this.maxCacheSize = 500 * 1024 * 1024; // 500MB
    this.currentCacheSize = 0;
  }

  async loadImage(url, performerId) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    if (this.pendingLoads.has(url)) {
      return this.pendingLoads.get(url);
    }

    const loadPromise = this._fetchAndCacheImage(url, performerId);
    this.pendingLoads.set(url, loadPromise);

    try {
      const result = await loadPromise;
      this.pendingLoads.delete(url);
      return result;
    } catch (err) {
      this.pendingLoads.delete(url);
      throw err;
    }
  }

  async _fetchAndCacheImage(url, performerId) {
    const startTime = performance.now();

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const loadTime = performance.now() - startTime;

      // Compress blob using JPEG/WebP if applicable
      const compressed = await this._compressBlob(blob);

      this.cache.set(url, {
        blob: compressed,
        originalSize: blob.size,
        compressedSize: compressed.size,
        loadTime,
        cachedAt: Date.now(),
        performerId
      });

      this.currentCacheSize += compressed.size;
      this._evictIfNeeded();

      return compressed;
    } catch (err) {
      throw new Error(`Image load failed: ${err.message}`);
    }
  }

  async _compressBlob(blob) {
    if (blob.type === 'image/webp' || blob.size < 50 * 1024) {
      return blob; // Already optimal
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((compressed) => {
          resolve(compressed || blob);
        }, 'image/webp', 0.8); // 80% quality
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  _evictIfNeeded() {
    if (this.currentCacheSize > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      for (const [url, data] of entries) {
        if (this.currentCacheSize <= this.maxCacheSize * 0.8) break;
        
        this.currentCacheSize -= data.compressedSize;
        this.cache.delete(url);
      }
    }
  }

  getStats() {
    return {
      cacheSize: this.currentCacheSize,
      itemCount: this.cache.size,
      avgCompressionRatio: this._calculateAvgCompressionRatio()
    };
  }

  _calculateAvgCompressionRatio() {
    const entries = Array.from(this.cache.values());
    const ratios = entries.map(e => e.compressedSize / e.originalSize);
    return ratios.length ? (ratios.reduce((a, b) => a + b) / ratios.length).toFixed(2) : 0;
  }
}
```

### 3.2 Delta Compression for Manifests

```javascript
// best/dbs/manifest-delta-encoder.py (NEW)
import gzip
import json
import hashlib
from typing import Dict, Any

class ManifestDeltaEncoder:
    """Incremental manifest compression using delta encoding."""
    
    def __init__(self, manifest_path: str):
        self.manifest_path = manifest_path
        self.previous_manifest = self._load_previous()
        self.current_manifest = None
    
    def _load_previous(self):
        try:
            with gzip.open(f"{self.manifest_path}.prev.gz", 'rt') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
    
    def encode_delta(self, current_manifest: Dict[str, Any]) -> bytes:
        """
        Encode delta between previous and current manifest.
        Only transmit changes, new entries, and removals.
        """
        self.current_manifest = current_manifest
        
        delta = {
            'added': {},
            'modified': {},
            'removed': [],
            'timestamp': int(time.time())
        }
        
        current_keys = set(current_manifest.keys())
        previous_keys = set(self.previous_manifest.keys())
        
        # Find additions and modifications
        for key in current_keys:
            if key not in self.previous_manifest:
                delta['added'][key] = current_manifest[key]
            elif self.previous_manifest[key] != current_manifest[key]:
                delta['modified'][key] = current_manifest[key]
        
        # Find removals
        delta['removed'] = list(previous_keys - current_keys)
        
        # Compress delta
        json_delta = json.dumps(delta, separators=(',', ':')).encode('utf-8')
        compressed = gzip.compress(json_delta, compresslevel=9)
        
        print(f"Delta compression: {len(json_delta)} → {len(compressed)} bytes ({100 * len(compressed) / len(json_delta):.1f}%)")
        
        return compressed
```

---

## Part 4: Analytics Pipeline

### 4.1 Event Analytics Engine

```javascript
// best/shared/analytics.ts (NEW)
class AnalyticsEngine {
  constructor(storageManager, eventBus) {
    this.storage = storageManager;
    this.eventBus = eventBus;
    this.aggregationWorker = null;
    this.aggregationInterval = 60000; // 60 seconds
  }

  async recordInteraction(performerId, eventType, metadata = {}) {
    const event = {
      performerId,
      eventType,
      timestamp: Date.now(),
      metadata,
      sessionId: this.getSessionId()
    };

    await this.storage.logTrackingEvent(event);
    this.eventBus.emit('analytics:event', event);
  }

  async generateHourlyReport(endTime = Date.now()) {
    const startTime = endTime - (3600 * 1000);
    const events = await this.storage.queryTrackingEvents({
      startTime,
      endTime,
      limit: 50000
    });

    const report = {
      period: { start: startTime, end: endTime },
      summary: {
        totalEvents: events.length,
        uniquePerformers: new Set(events.map(e => e.performerId)).size,
        eventBreakdown: this._breakdownByType(events),
        topPerformers: this._getTopPerformers(events, 10),
        engagementMetrics: this._calculateEngagement(events)
      }
    };

    return report;
  }

  async generateWeeklyTrends(endTime = Date.now()) {
    const days = 7;
    const dailyReports = [];

    for (let i = 0; i < days; i++) {
      const dayEnd = endTime - (i * 24 * 3600 * 1000);
      const dayStart = dayEnd - (24 * 3600 * 1000);
      
      const events = await this.storage.queryTrackingEvents({
        startTime: dayStart,
        endTime: dayEnd
      });

      dailyReports.push({
        date: new Date(dayEnd).toISOString().split('T')[0],
        eventCount: events.length,
        topPerformers: this._getTopPerformers(events, 5)
      });
    }

    return {
      period: `${days} days`,
      dailyReports,
      trend: this._calculateTrend(dailyReports)
    };
  }

  _breakdownByType(events) {
    const breakdown = {};
    events.forEach(e => {
      breakdown[e.eventType] = (breakdown[e.eventType] || 0) + 1;
    });
    return breakdown;
  }

  _getTopPerformers(events, count) {
    const performers = {};
    events.forEach(e => {
      if (!performers[e.performerId]) {
        performers[e.performerId] = { views: 0, favorites: 0, notes: 0 };
      }
      performers[e.performerId][e.eventType.toLowerCase() + 's']++;
    });

    return Object.entries(performers)
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, count)
      .map(([id, counts]) => ({ performerId: id, ...counts }));
  }

  _calculateEngagement(events) {
    return {
      avgEventsPerPerformer: (events.length / new Set(events.map(e => e.performerId)).size).toFixed(2),
      viewToFavoriteRatio: (events.filter(e => e.eventType === 'FAVORITE').length / events.filter(e => e.eventType === 'VIEW').length).toFixed(2)
    };
  }

  _calculateTrend(dailyReports) {
    const counts = dailyReports.map(d => d.eventCount);
    const avgPrev = counts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const avgRecent = counts.slice(-3).reduce((a, b) => a + b, 0) / 3;
    return ((avgRecent - avgPrev) / avgPrev * 100).toFixed(1) + '%';
  }

  getSessionId() {
    if (!window.__jinxSessionId) {
      window.__jinxSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return window.__jinxSessionId;
  }
}
```

---

## Part 5: Performance Optimizations

### 5.1 Web Worker Pool

```javascript
// best/shared/worker-pool.ts (NEW)
class WorkerPool {
  constructor(workerScript, poolSize = 4) {
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = new Set();
    this.taskMap = new Map();

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript);
      worker.onmessage = (e) => this._handleWorkerMessage(worker, e);
      this.workers.push(worker);
    }
  }

  async execute(task, data) {
    return new Promise((resolve, reject) => {
      const taskId = Math.random().toString(36);
      this.taskMap.set(taskId, { resolve, reject });

      const availableWorker = this.workers.find(w => !this.activeWorkers.has(w));
      
      if (availableWorker) {
        this.activeWorkers.add(availableWorker);
        availableWorker.postMessage({ taskId, task, data });
      } else {
        this.taskQueue.push({ taskId, task, data });
      }
    });
  }

  _handleWorkerMessage(worker, event) {
    const { taskId, result, error } = event.data;
    const { resolve, reject } = this.taskMap.get(taskId);

    if (error) {
      reject(new Error(error));
    } else {
      resolve(result);
    }

    this.taskMap.delete(taskId);
    this.activeWorkers.delete(worker);

    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      this.activeWorkers.add(worker);
      worker.postMessage(nextTask);
    }
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
  }
}
```

### 5.2 Virtual Scrolling Implementation

```javascript
// best/shared/virtual-scroller.ts (NEW)
class VirtualScroller {
  constructor(containerSelector, itemHeight, bufferSize = 5) {
    this.container = document.querySelector(containerSelector);
    this.itemHeight = itemHeight;
    this.bufferSize = bufferSize;
    this.items = [];
    this.visibleRange = { start: 0, end: 0 };
    this.scrollListener = null;

    this.container.addEventListener('scroll', () => this._onScroll());
  }

  setItems(items) {
    this.items = items;
    this._render();
  }

  _onScroll() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;

    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    const end = Math.min(
      this.items.length,
      Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize
    );

    if (start !== this.visibleRange.start || end !== this.visibleRange.end) {
      this.visibleRange = { start, end };
      this._render();
    }
  }

  _render() {
    const { start, end } = this.visibleRange;
    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
      const item = this.items[i];
      const el = document.createElement('div');
      el.className = 'virtual-item';
      el.style.transform = `translateY(${i * this.itemHeight}px)`;
      el.innerText = item;
      fragment.appendChild(el);
    }

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
```

---

## Part 6: Implementation Roadmap

| Phase | Target | Tasks | Est. Effort |
|-------|--------|-------|------------|
| **P1** | v6.0.5 | StorageManager enhanced schema, EventBus improvements | 2 weeks |
| **P2** | v6.1.0 | ImageCacheManager, Virtual Scroller, WorkerPool | 3 weeks |
| **P3** | v6.2.0 | AnalyticsEngine, Delta compression, Reports | 2 weeks |
| **P4** | v6.3.0 | Gamma integration, Real-time sync, UI polish | 2 weeks |

---

## Deployment Checklist

- [ ] Migrate existing localStorage data to new IndexedDB schema
- [ ] Implement backward compatibility layer
- [ ] Add feature flags for A/B testing
- [ ] Performance benchmarks baseline
- [ ] User acceptance testing with beta/gamma editions
- [ ] Migration guide for custom extensions
- [ ] Documentation updates

---

**Next Review:** 2026-08-15
