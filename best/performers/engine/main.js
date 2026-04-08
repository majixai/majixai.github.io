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

        Object.seal(this);
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
    // Slot recording state: Map<slotNumber, { mediaRecorder, stream, chunks, startedAt, blobUrl }>
    #_slotRecordings = new Map();
    // Shape engine for overlay shapes on iframes and images
    #_shapeEngine = null;
    // Background GPU image recognition analyzer
    #_backgroundAnalyzer = null;
    // MVC — Model layer (DataAPI + CacheManager)
    #_model = null;

    constructor() {
        // MVC — Model layer (data + persistence)
        this.#_model   = new PerformerEngineModel();
        this.#_dataAPI = this.#_model.dataAPI;   // backward-compat alias
        this.#_shapeEngine = new ShapeEngine(AppConfig.SHAPE_ENGINE_CONFIG);
        this.#_backgroundAnalyzer = new BackgroundImageAnalyzer({
            onResults: (results) => this.#_handleBackgroundAnalysisResults(results)
        });
        this.#_uiManager = new UIManager({
            onPerformerSelect: (performer) => this.#_handlePerformerSelection(performer),
            onRefresh: () => this.refresh(),
            onFilterChange: (filters, loadMore) => this.#_handleFilterChange(filters, loadMore),
            onSearch: (query) => this.#_handleSearch(query),
            onShapeSettingsChange: (settings) => this.#_handleShapeSettingsChange(settings)
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
        
        // Track click event
        try {
            await CacheManager.trackEvent({
                username: performer.username,
                eventType: 'click',
                metadata: {
                    display_name: performer.display_name,
                    gender: performer.gender,
                    viewers: performer.num_viewers
                }
            });
            
            // Update performer score based on click
            await this.#_updatePerformerScore(performer.username);
            
            // GPU image processing: move similar images to top and get similar performers
            const similarPerformers = await this.#_uiManager.moveSimilarImagesToTop(performer.username);

            // Feedback loop: signal the background analyzer that user interacted with this performer
            await this.#_backgroundAnalyzer.recordFeedback(performer.username, 3);

            // Award background tensor similarity points to visually similar performers
            if (similarPerformers && similarPerformers.length > 0) {
                this.#_awardPointsToSimilarPerformers(similarPerformers).catch(error => {
                    console.error('Error awarding similarity points:', error);
                });
            }
        } catch (error) {
            console.error("Error tracking click:", error);
        }
        
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
     * Attempt to load performers from cached .dat files as a fallback
     * @private
     * @returns {Promise<boolean>} true if cached performers were loaded successfully
     */
    async #_loadCachedFallback() {
        const cachedPerformers = await this.#_dataAPI.loadCachedPerformers();
        if (cachedPerformers.length > 0) {
            this.#_performers = Performer.createMany(cachedPerformers.slice(0, AppConfig.PERFORMERS_PER_PAGE));
            this.#_uiManager.renderPerformers(this.#_performers, false);
            this.#_uiManager.autoPopulateViewers(this.#_performers);
            this.#_uiManager.updateStatus({ count: this.#_performers.length, lastUpdate: Date.now() });
            console.log(`Fallback: Loaded ${this.#_performers.length} performers from cached data files`);
            return true;
        }
        return false;
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

            // Fallback: if API returned no performers, try loading from cached .dat files
            if (this.#_performers.length === 0 && !append && this.#_currentPage === 1) {
                console.warn("No performers from API, attempting to load from cached data files...");
                await this.#_loadCachedFallback();
            }

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
            // Fallback: try loading from cached .dat files on API failure
            if (!append) {
                try {
                    const loaded = await this.#_loadCachedFallback();
                    if (!loaded) {
                        this.#_uiManager.showError(error.message);
                    }
                } catch (fallbackError) {
                    console.error("Fallback also failed:", fallbackError);
                    this.#_uiManager.showError(error.message);
                }
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
     * Update performer score based on interactions
     * @private
     */
    async #_updatePerformerScore(username) {
        try {
            const stats = await CacheManager.getPerformerStats(username);
            
            // Recalculate performer ranking based on interactions
            const performer = this.#_performers.find(p => p.username === username);
            if (performer) {
                // Add click score to rank score
                performer.rankScore = (performer.rankScore || 0) + Math.min(stats.clickScore / 10, 50);

                console.log(`Updated score for ${username}: ${performer.rankScore}`);
                
                // Trigger re-sort (calculateRankScore in config.js handles all weight factors
                // including imageRecognition via a single consistent path)
                this.#_uiManager.reorderPerformersByScore(this.#_performers);
            }
        } catch (error) {
            console.error("Error updating performer score:", error);
        }
    }

    /**
     * Award background tensor similarity points to performers that look visually similar
     * to one that was explicitly clicked. Each performer receives a fractional award
     * scaled by its cosine similarity score and a feedback signal to the background
     * analyzer so that the ML loop reinforces their relevance.
     * @private
     * @param {Array<{username: string, similarity: number}>} similarPerformers
     */
    async #_awardPointsToSimilarPerformers(similarPerformers) {
        const mlConfig = AppConfig.ML_CONFIG;

        for (const { username, similarity } of similarPerformers) {
            // Scale the raw cosine similarity by feedbackDecayFactor to keep the award
            // slightly below the full similarity value, preventing runaway score inflation
            // from accumulated indirect awards (raw similarity arrives undecayed from ui.js).
            const weight = parseFloat((similarity * mlConfig.feedbackDecayFactor).toFixed(mlConfig.weightPrecision));
            if (weight <= 0) continue;

            try {
                // Persist a similarity_award event so it feeds into the clickScore formula
                await CacheManager.trackEvent({
                    username,
                    eventType: 'similarity_award',
                    metadata: { weight, source: 'tensor_similarity' }
                });

                // Update in-memory rankScore for immediate effect
                const performer = this.#_performers.find(p => p.username === username);
                if (performer) {
                    performer.rankScore = (performer.rankScore || 0) + weight;
                }

                // Reinforce the background analyzer feedback loop with a scaled signal
                await this.#_backgroundAnalyzer.recordFeedback(username, weight);
            } catch (error) {
                console.warn(`Could not award similarity points to ${username}:`, error);
            }
        }

        // Re-sort once after all awards are applied
        if (similarPerformers.length > 0) {
            this.#_uiManager.reorderPerformersByScore(this.#_performers);
            console.log(`Tensor similarity: awarded background points to ${similarPerformers.length} similar performer(s)`);
        }
    }

    /**
     * Handle results from the background GPU image recognition analyzer.
     * This is the feedback loop: analysis results trigger a re-sort so that
     * the calculateRankScore weighting (which includes imageRecognition) is applied.
     * @private
     * @param {Array<Object>} results - Array of recognition results from the latest cycle
     */
    async #_handleBackgroundAnalysisResults(results) {
        if (!results || results.length === 0) return;

        console.log(`BackgroundAnalysis feedback: ${results.length} new results available, triggering re-sort`);
        this.#_uiManager.reorderPerformersByScore(this.#_performers);
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

    // ==================== Per-Slot Recording Methods ====================

    /**
     * Initialize slot recording controls
     * @private
     */
    #_initSlotRecordingControls() {
        const iframeGrid = document.querySelector('#iframeGrid');
        if (!iframeGrid) return;

        // Handle record button clicks
        iframeGrid.addEventListener('click', (e) => {
            const recordBtn = e.target.closest('.slot-record-btn');
            if (recordBtn) {
                const slot = parseInt(recordBtn.dataset.slot);
                if (this.#_slotRecordings.has(slot) && this.#_slotRecordings.get(slot).mediaRecorder) {
                    this.#_stopSlotRecording(slot);
                } else {
                    this.#_startSlotRecording(slot);
                }
                return;
            }

            const playBtn = e.target.closest('.slot-play-btn');
            if (playBtn) {
                const slot = parseInt(playBtn.dataset.slot);
                this.#_toggleSlotPlayback(slot);
                return;
            }

            const closeVideoBtn = e.target.closest('.video-close-btn');
            if (closeVideoBtn) {
                const slot = parseInt(closeVideoBtn.dataset.slot);
                this.#_hideSlotPlayback(slot);
            }
        });
    }

    /**
     * Start recording a specific slot
     * @param {number} slot
     * @private
     */
    async #_startSlotRecording(slot) {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            console.warn(`Slot ${slot}: Screen recording not supported.`);
            return;
        }
        if (!window.MediaRecorder) {
            console.warn(`Slot ${slot}: MediaRecorder not available.`);
            return;
        }

        try {
            // Try with audio first, fallback to video-only if audio fails
            let stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
            } catch (audioError) {
                console.warn(`Slot ${slot}: Audio capture not available, recording video only.`);
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });
            }

            const mimeType = this.#_getSupportedRecordingMimeType();
            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            const chunks = [];
            const startedAt = Date.now();

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const recordedMime = mediaRecorder.mimeType || mimeType || 'video/webm';
                const blob = new Blob(chunks, { type: recordedMime });
                
                // Revoke previous blob URL to prevent memory leaks
                const existingState = this.#_slotRecordings.get(slot);
                if (existingState?.blobUrl) {
                    URL.revokeObjectURL(existingState.blobUrl);
                }
                
                const blobUrl = URL.createObjectURL(blob);

                // Update state with the recording blob
                const state = this.#_slotRecordings.get(slot);
                if (state) {
                    state.blobUrl = blobUrl;
                    state.blob = blob;
                    state.mediaRecorder = null;
                    state.stream = null;
                    state.durationMs = Date.now() - state.startedAt;
                }

                // Update UI
                this.#_updateSlotRecordingUI(slot, false);
                this.#_showSlotPlayButton(slot, true);

                // Cleanup stream tracks
                stream.getTracks().forEach(track => track.stop());
            };

            // Track ended externally (e.g. user stopped sharing)
            stream.getVideoTracks().forEach((track) => {
                track.addEventListener('ended', () => {
                    if (mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                });
            });

            // Store recording state
            this.#_slotRecordings.set(slot, {
                mediaRecorder,
                stream,
                chunks,
                startedAt,
                blobUrl: null,
                blob: null,
                durationMs: 0
            });

            mediaRecorder.start(250);
            this.#_updateSlotRecordingUI(slot, true);
            console.log(`Slot ${slot}: Recording started.`);

        } catch (error) {
            console.error(`Slot ${slot}: Failed to start recording:`, error);
            this.#_slotRecordings.delete(slot);
        }
    }

    /**
     * Stop recording a specific slot
     * @param {number} slot
     * @private
     */
    #_stopSlotRecording(slot) {
        const state = this.#_slotRecordings.get(slot);
        if (!state || !state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
            return;
        }
        state.mediaRecorder.stop();
        console.log(`Slot ${slot}: Recording stopped.`);
    }

    /**
     * Update UI to reflect recording state
     * @param {number} slot
     * @param {boolean} isRecording
     * @private
     */
    #_updateSlotRecordingUI(slot, isRecording) {
        const recordBtn = document.querySelector(`.slot-record-btn[data-slot="${slot}"]`);
        if (!recordBtn) return;

        if (isRecording) {
            recordBtn.classList.add('recording');
            recordBtn.textContent = '⏹';
            recordBtn.title = 'Stop Recording';
        } else {
            recordBtn.classList.remove('recording');
            recordBtn.textContent = '⏺';
            recordBtn.title = 'Start Recording';
        }
    }

    /**
     * Show/hide play button for a slot
     * @param {number} slot
     * @param {boolean} show
     * @private
     */
    #_showSlotPlayButton(slot, show) {
        const playBtn = document.querySelector(`.slot-play-btn[data-slot="${slot}"]`);
        if (playBtn) {
            playBtn.style.display = show ? 'inline-block' : 'none';
        }
    }

    /**
     * Toggle playback of recorded video over the iframe
     * @param {number} slot
     * @private
     */
    #_toggleSlotPlayback(slot) {
        const state = this.#_slotRecordings.get(slot);
        if (!state || !state.blobUrl) {
            console.warn(`Slot ${slot}: No recording available.`);
            return;
        }

        const videoOverlay = document.querySelector(`.slot-video-overlay[data-slot="${slot}"]`);
        if (!videoOverlay) return;

        const wrapper = videoOverlay.closest('.iframe-wrapper');

        if (videoOverlay.style.display === 'none' || !videoOverlay.style.display) {
            // Show video overlay
            videoOverlay.src = state.blobUrl;
            videoOverlay.style.display = 'block';
            videoOverlay.play().catch((err) => {
                console.warn(`Slot ${slot}: Playback failed:`, err.message);
            });

            // Add close button if not present
            let closeBtn = wrapper.querySelector('.video-close-btn');
            if (!closeBtn) {
                closeBtn = document.createElement('button');
                closeBtn.className = 'video-close-btn';
                closeBtn.dataset.slot = slot;
                closeBtn.textContent = '×';
                closeBtn.title = 'Close playback';
                wrapper.appendChild(closeBtn);
            }
            closeBtn.style.display = 'flex';
        } else {
            // Toggle pause/play
            if (videoOverlay.paused) {
                videoOverlay.play().catch((err) => {
                    console.warn(`Slot ${slot}: Playback failed:`, err.message);
                });
            } else {
                videoOverlay.pause();
            }
        }
    }

    /**
     * Hide slot playback and resume live view
     * @param {number} slot
     * @private
     */
    #_hideSlotPlayback(slot) {
        const videoOverlay = document.querySelector(`.slot-video-overlay[data-slot="${slot}"]`);
        if (videoOverlay) {
            videoOverlay.pause();
            videoOverlay.style.display = 'none';
        }

        const wrapper = document.querySelector(`.iframe-wrapper[data-slot="${slot}"]`);
        const closeBtn = wrapper?.querySelector('.video-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'none';
        }
    }

    /**
     * Handle shape engine setting changes from UI
     * @private
     */
    async #_handleShapeSettingsChange(settings) {
        if (!this.#_shapeEngine) return;

        if (settings.shapesEnabled !== undefined) {
            this.#_shapeEngine.shapesEnabled = settings.shapesEnabled;
        }
        if (settings.mlShapesEnabled !== undefined) {
            this.#_shapeEngine.mlShapesEnabled = settings.mlShapesEnabled;
        }
        if (settings.performerMode !== undefined) {
            this.#_shapeEngine.performerMode = settings.performerMode;
        }
        if (settings.complexity !== undefined) {
            this.#_shapeEngine.complexity = settings.complexity;
        }

        // Save settings
        try {
            await CacheManager.saveSetting('shapeEngineConfig', this.#_shapeEngine.getConfig());
        } catch (error) {
            console.warn('Failed to save shape engine config:', error);
        }

        // Re-apply overlays
        this.#_applyShapeOverlays();
    }

    /**
     * Apply shape overlays to visible iframes and images
     * @private
     */
    async #_applyShapeOverlays() {
        if (!this.#_shapeEngine) return;

        const iframeGrid = document.querySelector('#iframeGrid');
        const performerGrid = document.querySelector('#performerGrid');

        // Get ML prediction function if ML shapes are enabled
        const getPrediction = this.#_shapeEngine.mlShapesEnabled
            ? async (username) => {
                const performer = this.#_performers.find(p => p.username === username);
                if (performer?.image_url) {
                    return this.#_uiManager.inferImageLabel(performer.image_url);
                }
                return null;
            }
            : null;

        await this.#_shapeEngine.applyToIframes(iframeGrid, this.#_uiManager.getViewerSlots(), getPrediction);
        await this.#_shapeEngine.applyToImages(performerGrid, getPrediction);
    }

    /**
     * Start periodic refresh
     * @private
     */
    #_startPeriodicRefresh() {
        // Automatic refresh disabled per requirements
        // Users can manually refresh using the refresh button
        if (this.#_fetchInterval) {
            clearInterval(this.#_fetchInterval);
            this.#_fetchInterval = null;
        }
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

        // Load saved shape engine settings
        try {
            const savedShapeConfig = await CacheManager.getSetting('shapeEngineConfig');
            if (savedShapeConfig && this.#_shapeEngine) {
                if (savedShapeConfig.shapesEnabled !== undefined) this.#_shapeEngine.shapesEnabled = savedShapeConfig.shapesEnabled;
                if (savedShapeConfig.mlShapesEnabled !== undefined) this.#_shapeEngine.mlShapesEnabled = savedShapeConfig.mlShapesEnabled;
                if (savedShapeConfig.performerMode !== undefined) this.#_shapeEngine.performerMode = savedShapeConfig.performerMode;
                if (savedShapeConfig.complexity !== undefined) this.#_shapeEngine.complexity = savedShapeConfig.complexity;
                this.#_uiManager.updateShapeControls(this.#_shapeEngine.getConfig());
            }
        } catch (error) {
            console.warn("Could not load saved shape config:", error);
        }

        // Initialize snippets
        await this.#_initSnippets();

        // Initialize slot recording controls
        this.#_initSlotRecordingControls();

        // Load performers
        await this.#_loadPerformers(false);

        // Start periodic refresh
        this.#_startPeriodicRefresh();

        // Initialize zoom handlers for iframes and images
        this.#_uiManager.initZoomHandlers();

        // Pass ML model to shape engine and background analyzer once loaded
        if (this.#_uiManager.getMLModel) {
            const mlModel = await this.#_uiManager.getMLModel();
            if (mlModel) {
                this.#_shapeEngine.setMLModel(mlModel);
                this.#_backgroundAnalyzer.setModel(mlModel);
                this.#_backgroundAnalyzer.start();
            }
        }

        // Load server-side GPU recognition results and seed into IndexedDB
        // Server-side features are basic metadata (not MobileNet vectors);
        // client-side BackgroundImageAnalyzer will overlay with full ML features later
        try {
            const recognitionResults = await this.#_dataAPI.loadRecognitionManifest();
            for (const item of recognitionResults) {
                // Only seed if no client-side analysis exists yet
                const existing = await CacheManager.getRecognitionResult(item.username);
                if (!existing) {
                    await CacheManager.saveRecognitionResult({
                        username: item.username,
                        predictions: [],
                        featureVector: null, // Server features are metadata, not ML vectors
                        analyzedAt: item.analyzed_at || Date.now(),
                        feedbackScore: item.feedback_score || 0,
                        imageUrl: item.image_url || ''
                    });
                }
            }
            if (recognitionResults.length > 0) {
                console.log(`BestPerformersEngine: Seeded ${recognitionResults.length} server-side recognition results`);
            }
        } catch (error) {
            console.warn("Could not load server recognition manifest:", error);
        }

        // Apply initial shape overlays if enabled
        this.#_applyShapeOverlays();

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