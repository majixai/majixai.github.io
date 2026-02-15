/**
 * @file Main Best Performers Engine class and application entry point.
 * @description Orchestrates all modules for the enhanced performer viewing experience.
 */

/**
 * @class Performer
 * @description Data class for performer objects
 */
class Performer {
    username;
    display_name;
    image_url;
    iframe_embed;
    age;
    gender;
    num_viewers;
    is_new;
    tags;
    current_show;
    rankScore;

    constructor(data) {
        this.username = data.username;
        this.display_name = data.display_name || data.username;
        this.image_url = data.image_url || data.profile_pic_url;
        this.iframe_embed = data.iframe_embed;
        this.age = data.age;
        this.gender = data.gender;
        this.num_viewers = data.num_viewers || 0;
        this.is_new = data.is_new || false;
        this.tags = data.tags || [];
        this.current_show = data.current_show;
        this.rankScore = data.rankScore || 0;

        Object.freeze(this);
    }

    static createMany(performerData) {
        return performerData.map(data => new Performer(data));
    }
}

/**
 * @class BestPerformersEngine
 * @description Main application orchestrator
 */
class BestPerformersEngine {
    #_uiManager;
    #_dataAPI;
    #_performers = [];
    #_currentPage = 1;
    #_currentFilters = {};
    #_fetchInterval = null;
    #_mediaRecorder = null;
    #_recordingChunks = [];
    #_recordingStream = null;
    #_recordingStartedAt = 0;
    #_recordings = [];
    #_recordingElements = {};
    #_recordingPreviewUrl = null;

    constructor() {
        this.#_dataAPI = new DataAPI(CacheManager);
        this.#_uiManager = new UIManager({
            onPerformerSelect: (performer) => this.#_handlePerformerSelection(performer),
            onRefresh: () => this.refresh(),
            onFilterChange: (filters, loadMore) => this.#_handleFilterChange(filters, loadMore),
            onSearch: (query) => this.#_handleSearch(query)
        });

        this.#_currentFilters = { ...AppConfig.DEFAULT_FILTERS };
    }

    /**
     * Handle performer selection
     * @private
     */
    async #_handlePerformerSelection(performer) {
        console.log(`Performer selected: ${performer.display_name || performer.username}`);
        
        this.#_uiManager.updateViewer(performer);
        
        // Add to history
        try {
            await CacheManager.addToHistory(performer.username);
        } catch (error) {
            console.error("Error adding to history:", error);
        }
    }

    /**
     * Handle filter changes
     * @private
     */
    async #_handleFilterChange(filters, loadMore = false) {
        if (loadMore) {
            this.#_currentPage++;
        } else {
            this.#_currentPage = 1;
            this.#_currentFilters = { ...filters };
        }

        await this.#_loadPerformers(loadMore);
    }

    /**
     * Handle search input
     * @private
     */
    async #_handleSearch(query) {
        this.#_currentFilters.search = query;
        this.#_currentPage = 1;
        await this.#_loadPerformers(false);
    }

    /**
     * Load performers with current filters
     * @private
     */
    async #_loadPerformers(append = false) {
        if (!append) {
            this.#_uiManager.showLoading();
        }

        try {
            const result = await this.#_dataAPI.getPerformers({
                filters: this.#_currentFilters,
                page: this.#_currentPage,
                perPage: AppConfig.PERFORMERS_PER_PAGE
            });

            this.#_performers = Performer.createMany(result.performers);

            if (this.#_performers.length > 0) {
                this.#_uiManager.renderPerformers(this.#_performers, append);
                this.#_uiManager.showLoadMore(result.hasMore);
                
                // Auto-populate viewers on first load
                if (this.#_currentPage === 1 && !append) {
                    this.#_uiManager.autoPopulateViewers(this.#_performers);
                }
            } else if (!append) {
                this.#_uiManager.showError('No performers found matching your criteria.');
            }

            this.#_uiManager.updateStatus({
                count: result.total,
                lastUpdate: Date.now()
            });

        } catch (error) {
            console.error("Failed to load performers:", error);
            if (!append) {
                this.#_uiManager.showError(error.message);
            }
        } finally {
            this.#_uiManager.hideLoading();
        }
    }

    /**
     * Refresh performer data
     */
    async refresh() {
        this.#_currentPage = 1;
        await this.#_dataAPI.getPerformers({ forceRefresh: true, filters: this.#_currentFilters });
        await this.#_loadPerformers(false);
    }

    /**
     * Initialize snippet functionality
     * @private
     */
    async #_initSnippets() {
        // Load existing snippets
        try {
            const snippets = await CacheManager.getAllSnippets();
            this.#_uiManager.renderSnippets(snippets);
        } catch (error) {
            console.error("Error loading snippets:", error);
        }

        // Save snippet button handler
        const saveBtn = document.querySelector('#saveSnippetButton');
        saveBtn?.addEventListener('click', async () => {
            const text = this.#_uiManager.getSnippetInput();
            if (!text.trim()) {
                this.#_uiManager.showSnippetStatus('Snippet cannot be empty', 'error');
                return;
            }

            try {
                await CacheManager.addSnippet(text);
                const snippets = await CacheManager.getAllSnippets();
                this.#_uiManager.renderSnippets(snippets);
                this.#_uiManager.clearSnippetInput();
                this.#_uiManager.showSnippetStatus('Snippet saved!', 'success');
            } catch (error) {
                this.#_uiManager.showSnippetStatus(error.message, 'error');
            }
        });

        // Delete snippet handler (event delegation)
        const snippetsList = document.querySelector('#snippetsList');
        snippetsList?.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const id = parseInt(e.target.dataset.id);
                if (id) {
                    try {
                        await CacheManager.deleteSnippet(id);
                        const snippets = await CacheManager.getAllSnippets();
                        this.#_uiManager.renderSnippets(snippets);
                        this.#_uiManager.showSnippetStatus('Snippet deleted', 'success');
                    } catch (error) {
                        this.#_uiManager.showSnippetStatus('Failed to delete', 'error');
                    }
                }
            }
        });

        // Autocomplete for main text area
        const mainTextArea = document.querySelector('#mainTextArea');
        mainTextArea?.addEventListener('input', async (e) => {
            const text = e.target.value;
            const triggerPos = text.lastIndexOf('{{');
            
            if (triggerPos !== -1 && triggerPos === text.length - 2) {
                // Just typed '{{', show all snippets
                const snippets = await CacheManager.getAllSnippets();
                this.#_uiManager.showAutocompleteSuggestions(snippets);
            } else if (triggerPos !== -1) {
                const query = text.substring(triggerPos + 2);
                if (query.length > 0) {
                    const snippets = await CacheManager.searchSnippets(query);
                    this.#_uiManager.showAutocompleteSuggestions(snippets);
                }
            } else {
                this.#_uiManager.hideAutocompleteSuggestions();
            }
        });

        mainTextArea?.addEventListener('blur', () => {
            setTimeout(() => {
                this.#_uiManager.hideAutocompleteSuggestions();
            }, 150);
        });

        await this.#_initScreenRecording();
    }

    /**
     * Initialize screen recording controls
     * @private
     */
    async #_initScreenRecording() {
        this.#_recordingElements = {
            startBtn: document.querySelector('#startRecordingBtn'),
            stopBtn: document.querySelector('#stopRecordingBtn'),
            refreshBtn: document.querySelector('#refreshRecordingsBtn'),
            list: document.querySelector('#recordingList'),
            playBtn: document.querySelector('#playRecordingBtn'),
            downloadBtn: document.querySelector('#downloadRecordingBtn'),
            deleteBtn: document.querySelector('#deleteRecordingBtn'),
            preview: document.querySelector('#recordingPreview'),
            status: document.querySelector('#recordingStatus')
        };

        this.#_recordingElements.startBtn?.addEventListener('click', () => this.#_startScreenRecording());
        this.#_recordingElements.stopBtn?.addEventListener('click', () => this.#_stopScreenRecording());
        this.#_recordingElements.refreshBtn?.addEventListener('click', () => this.#_loadRecordings());
        this.#_recordingElements.list?.addEventListener('change', () => this.#_loadSelectedRecordingPreview());
        this.#_recordingElements.playBtn?.addEventListener('click', () => {
            this.#_recordingElements.preview?.play().catch(() => {});
        });
        this.#_recordingElements.downloadBtn?.addEventListener('click', () => this.#_downloadSelectedRecording());
        this.#_recordingElements.deleteBtn?.addEventListener('click', () => this.#_deleteSelectedRecording());

        await this.#_loadRecordings();
    }

    /**
     * Show recording status
     * @private
     */
    #_setRecordingStatus(message, type = 'success') {
        const statusEl = this.#_recordingElements.status;
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = `snippet-status ${type}`;
        statusEl.style.display = 'block';
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3500);
    }

    /**
     * Update recording buttons
     * @private
     */
    #_setRecordingUiState(isRecording) {
        if (this.#_recordingElements.startBtn) {
            this.#_recordingElements.startBtn.disabled = isRecording;
        }
        if (this.#_recordingElements.stopBtn) {
            this.#_recordingElements.stopBtn.disabled = !isRecording;
        }
    }

    /**
     * Select supported mime type
     * @private
     */
    #_getSupportedRecordingMimeType() {
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        for (const mimeType of candidates) {
            if (window.MediaRecorder?.isTypeSupported?.(mimeType)) {
                return mimeType;
            }
        }
        return '';
    }

    /**
     * Start recording screen
     * @private
     */
    async #_startScreenRecording() {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            this.#_setRecordingStatus('Screen recording is not supported in this browser.', 'error');
            return;
        }
        if (!window.MediaRecorder) {
            this.#_setRecordingStatus('MediaRecorder API is not available.', 'error');
            return;
        }

        try {
            this.#_recordingStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            const mimeType = this.#_getSupportedRecordingMimeType();
            this.#_mediaRecorder = mimeType
                ? new MediaRecorder(this.#_recordingStream, { mimeType })
                : new MediaRecorder(this.#_recordingStream);

            this.#_recordingChunks = [];
            this.#_recordingStartedAt = Date.now();

            this.#_mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.#_recordingChunks.push(event.data);
                }
            };

            this.#_mediaRecorder.onstop = async () => {
                const durationMs = Date.now() - this.#_recordingStartedAt;
                const selectedMimeType = this.#_mediaRecorder?.mimeType || mimeType || 'video/webm';
                const blob = new Blob(this.#_recordingChunks, { type: selectedMimeType });
                const extension = selectedMimeType.includes('webm') ? 'webm' : 'mp4';
                const filename = `screen_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;

                await CacheManager.addRecording({
                    createdAt: Date.now(),
                    durationMs,
                    mimeType: selectedMimeType,
                    byteSize: blob.size,
                    filename,
                    blob
                });

                this.#_setRecordingStatus('Recording saved to IndexedDB.', 'success');
                await this.#_loadRecordings();
                this.#_cleanupRecordingStream();
            };

            this.#_recordingStream.getVideoTracks().forEach((track) => {
                track.addEventListener('ended', () => {
                    if (this.#_mediaRecorder && this.#_mediaRecorder.state !== 'inactive') {
                        this.#_mediaRecorder.stop();
                    }
                });
            });

            this.#_mediaRecorder.start(250);
            this.#_setRecordingUiState(true);
            this.#_setRecordingStatus('Recording started.', 'success');
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.#_cleanupRecordingStream();
            this.#_setRecordingUiState(false);
            this.#_setRecordingStatus('Failed to start recording.', 'error');
        }
    }

    /**
     * Stop active recording
     * @private
     */
    #_stopScreenRecording() {
        if (!this.#_mediaRecorder || this.#_mediaRecorder.state === 'inactive') {
            return;
        }
        this.#_mediaRecorder.stop();
        this.#_setRecordingUiState(false);
    }

    /**
     * Cleanup current recording stream
     * @private
     */
    #_cleanupRecordingStream() {
        if (this.#_recordingStream) {
            this.#_recordingStream.getTracks().forEach(track => track.stop());
            this.#_recordingStream = null;
        }
        this.#_mediaRecorder = null;
        this.#_recordingChunks = [];
        this.#_setRecordingUiState(false);
    }

    /**
     * Load saved recordings list
     * @private
     */
    async #_loadRecordings() {
        try {
            this.#_recordings = await CacheManager.getAllRecordings();
            const select = this.#_recordingElements.list;
            if (!select) return;

            select.innerHTML = '';
            if (!this.#_recordings.length) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No recordings';
                select.appendChild(opt);
                this.#_setPreviewBlob(null);
                return;
            }

            this.#_recordings.forEach((recording) => {
                const opt = document.createElement('option');
                opt.value = String(recording.id);
                const created = new Date(recording.createdAt || Date.now()).toLocaleString();
                const seconds = ((recording.durationMs || 0) / 1000).toFixed(1);
                const megabytes = ((recording.byteSize || 0) / 1024 / 1024).toFixed(2);
                opt.textContent = `${created} • ${seconds}s • ${megabytes}MB`;
                select.appendChild(opt);
            });

            select.value = String(this.#_recordings[0].id);
            await this.#_loadSelectedRecordingPreview();
        } catch (error) {
            console.error('Failed to load recordings:', error);
            this.#_setRecordingStatus('Failed to load recordings.', 'error');
        }
    }

    /**
     * Get currently selected recording
     * @private
     */
    #_getSelectedRecording() {
        const selectedId = parseInt(this.#_recordingElements.list?.value, 10);
        if (!selectedId) return null;
        return this.#_recordings.find(r => r.id === selectedId) || null;
    }

    /**
     * Bind blob to preview video
     * @private
     */
    #_setPreviewBlob(blob) {
        const preview = this.#_recordingElements.preview;
        if (!preview) return;

        if (this.#_recordingPreviewUrl) {
            URL.revokeObjectURL(this.#_recordingPreviewUrl);
            this.#_recordingPreviewUrl = null;
        }

        if (!blob) {
            preview.removeAttribute('src');
            preview.load();
            return;
        }

        this.#_recordingPreviewUrl = URL.createObjectURL(blob);
        preview.src = this.#_recordingPreviewUrl;
        preview.load();
    }

    /**
     * Load selected recording into preview
     * @private
     */
    async #_loadSelectedRecordingPreview() {
        const selected = this.#_getSelectedRecording();
        this.#_setPreviewBlob(selected?.blob || null);
    }

    /**
     * Download selected recording
     * @private
     */
    #_downloadSelectedRecording() {
        const selected = this.#_getSelectedRecording();
        if (!selected?.blob) {
            this.#_setRecordingStatus('No recording selected.', 'error');
            return;
        }

        const url = URL.createObjectURL(selected.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selected.filename || `screen_recording_${selected.id}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Delete selected recording
     * @private
     */
    async #_deleteSelectedRecording() {
        const selected = this.#_getSelectedRecording();
        if (!selected?.id) {
            this.#_setRecordingStatus('No recording selected.', 'error');
            return;
        }

        try {
            await CacheManager.deleteRecording(selected.id);
            await this.#_loadRecordings();
            this.#_setRecordingStatus('Recording deleted.', 'success');
        } catch (error) {
            console.error('Failed to delete recording:', error);
            this.#_setRecordingStatus('Failed to delete recording.', 'error');
        }
    }

    /**
     * Start periodic refresh
     * @private
     */
    #_startPeriodicRefresh() {
        if (this.#_fetchInterval) {
            clearInterval(this.#_fetchInterval);
        }
        
        this.#_fetchInterval = setInterval(async () => {
            console.log("Periodic refresh triggered");
            await this.refresh();
        }, AppConfig.FETCH_INTERVAL);
    }

    /**
     * Log visit for analytics
     * @private
     */
    #_logVisit() {
        const data = {
            timestamp: new Date().toISOString(),
            target: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            event_type: 'page_visit'
        };

        if (navigator.sendBeacon && AppConfig.LOGGING_SERVICE_URL) {
            navigator.sendBeacon(AppConfig.LOGGING_SERVICE_URL, JSON.stringify(data));
        }
    }

    /**
     * Main initialization
     */
    async init() {
        console.log("BestPerformersEngine: Initializing...");
        
        this.#_logVisit();
        
        // Load saved filter preferences
        try {
            const savedFilters = await CacheManager.getFilters();
            this.#_currentFilters = { ...AppConfig.DEFAULT_FILTERS, ...savedFilters };
        } catch (error) {
            console.warn("Could not load saved filters:", error);
        }

        // Initialize snippets
        await this.#_initSnippets();

        // Load performers
        await this.#_loadPerformers(false);

        // Start periodic refresh
        this.#_startPeriodicRefresh();

        console.log("BestPerformersEngine: Initialization complete");
    }
}

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    const engine = new BestPerformersEngine();
    engine.init().catch(error => {
        console.error("Failed to initialize BestPerformersEngine:", error);
    });
});