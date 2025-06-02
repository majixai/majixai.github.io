// This is the JavaScript file for job_advertisement.html.
// It will contain classes for App, Parallax, StorageManager, ContentLoader, and NotesManager.

/**
 * App Class
 * Responsible for initializing and coordinating other modules.
 */
class App {
    constructor() {
        this.storageManager = new StorageManager();
        this.notesManager = new NotesManager(this.storageManager);
        this.contentLoader = new ContentLoader();
        this.parallaxEffect = new Parallax(); // Instantiate Parallax here
    }

    init() {
        this.parallaxEffect.applyEffect('#parallax-header');
        this.initNotificationBanner();
        this.notesManager.init(); // Handles its own DB init and subsequent actions
        this.loadCompanyValues();
    }

    initNotificationBanner() {
        const banner = $('#notification-banner');
        const dismissButton = $('#dismiss-notification');
        const storageKey = 'notificationDismissed';

        if (!banner.length || !dismissButton.length) {
            // This warning is useful if HTML elements are missing
            console.warn("Notification banner or dismiss button not found in the DOM.");
            return;
        }

        const dismissed = this.storageManager.loadLocal(storageKey);
        if (dismissed === true) {
            banner.hide();
        } else {
            banner.show();
        }

        dismissButton.on('click', () => {
            banner.slideUp();
            this.storageManager.saveLocal(storageKey, true);
        });
    }

    loadCompanyValues() {
        const section = $('#company-values-section');
        if (!section.length) {
            console.warn("Company values section #company-values-section not found in the DOM.");
            return;
        }

        this.contentLoader.loadJson('company_values.json')
            .done(data => {
                if (!data || !data.title || !Array.isArray(data.values)) { // Check if values is an array
                    console.error("Loaded company values data is not in the expected format:", data);
                    section.html('<p class="error-text">Error: Could not load company values due to invalid data format.</p>');
                    return;
                }
                section.empty();

                section.append($('<h2>').text(data.title));
                const ul = $('<ul class="values-list">');
                data.values.forEach(value => {
                    // Using notesManager's escapeHtml for convenience.
                    // Ideally, this would be a shared utility or part of App/ContentLoader if more widely used.
                    const name = this.notesManager.escapeHtml(value.name || '');
                    const description = this.notesManager.escapeHtml(value.description || '');
                    const listItem = $('<li>').html(`<strong>${name}:</strong> <p class="value-description">${description}</p>`);
                    ul.append(listItem);
                });
                section.append(ul);
                // console.log("Company values loaded and displayed."); // Can be kept for QA
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error(`Failed to load company_values.json: ${textStatus}`, errorThrown);
                section.html('<p class="error-text">Sorry, we could not load our company values at the moment. Please try again later.</p>');
            });
    }
}

/**
 * Parallax Class
 */
class Parallax {
    constructor(speedFactor = 0.5) {
        this.speedFactor = speedFactor;
    }

    applyEffect(selector) {
        const $element = $(selector);
        if (!$element.length) {
            console.error(`Parallax: Element "${selector}" not found.`);
            return;
        }
        this.$element = $element;
        $(window).on('scroll', () => {
            if (!this.$element.length) return;
            const scrollTop = $(window).scrollTop();
            const newPositionY = scrollTop * this.speedFactor;
            this.$element.css('background-position-y', `calc(50% + ${newPositionY}px)`);
        });
    }
}

/**
 * StorageManager Class
 */
class StorageManager {
    constructor(dbName = 'JobAppDB', defaultStoreName = 'notes') {
        this.db = null;
        this.dbName = dbName;
        this.defaultStoreName = defaultStoreName;
        // console.log("StorageManager initialized for DB:", dbName); // Removed for cleaner console
    }

    saveLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving to localStorage (key: ${key}):`, error);
        }
    }

    loadLocal(key) {
        const item = localStorage.getItem(key);
        if (item === null) return null;
        try {
            return JSON.parse(item);
        } catch (error) {
            console.error(`Error parsing JSON from localStorage (key: ${key}):`, error);
            return null;
        }
    }

    initDB(storeName) {
        const currentStoreName = storeName || this.defaultStoreName;
        return new Promise((resolve, reject) => {
            if (this.db && this.db.objectStoreNames.contains(currentStoreName)) {
                resolve(this.db);
                return;
            }
             if (this.db && !this.db.objectStoreNames.contains(currentStoreName)){
                 console.warn(`StorageManager: DB is open but store "${currentStoreName}" not found. Re-opening for upgrade.`);
                 this.db.close(); // Close before reopening for upgrade
                 this.db = null;
            }

            // Increment version if store needs to be created after initial DB creation
            // For simplicity, we use version 1 and create store if missing.
            // A more robust versioning system would increment this.db.version or a passed-in version.
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(currentStoreName)) {
                    db.createObjectStore(currentStoreName, { keyPath: 'id', autoIncrement: true });
                    console.log(`StorageManager: Object store "${currentStoreName}" created.`);
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                // console.log(`StorageManager: IndexedDB "${this.dbName}" ready.`); // Can be too verbose
                resolve(this.db);
            };
            request.onerror = (event) => {
                console.error(`StorageManager: IndexedDB error opening "${this.dbName}":`, event.target.error); // Use event.target.error
                reject(event.target.error);
            };
        });
    }

    _getStore(storeName, mode = 'readonly') {
        if (!this.db) {
            // This should ideally not happen if initDB is always awaited.
            console.error("StorageManager: Database not initialized before _getStore call.");
            throw new Error("Database not initialized.");
        }
        const currentStoreName = storeName || this.defaultStoreName;
        return this.db.transaction([currentStoreName], mode).objectStore(currentStoreName);
    }

    saveNote(noteText, storeName) {
        const noteObject = { id: Date.now(), text: noteText, timestamp: new Date() };
        return new Promise((resolve, reject) => {
            this.initDB(storeName).then(() => {
                const store = this._getStore(storeName, 'readwrite');
                const request = store.add(noteObject);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("StorageManager: Error saving note:", e.target.error);
                    reject(e.target.error);
                };
            }).catch(err => {
                 console.error("StorageManager: DB init failed before saving note:", err);
                 reject(err);
            });
        });
    }

    loadNotes(storeName) {
        return new Promise((resolve, reject) => {
             this.initDB(storeName).then(() => {
                const store = this._getStore(storeName, 'readonly');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("StorageManager: Error loading notes:", e.target.error);
                    reject(e.target.error);
                };
            }).catch(err => {
                 console.error("StorageManager: DB init failed before loading notes:", err);
                 reject(err);
            });
        });
    }

    deleteNote(noteId, storeName) {
        return new Promise((resolve, reject) => {
            this.initDB(storeName).then(() => {
                const store = this._getStore(storeName, 'readwrite');
                const request = store.delete(noteId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("StorageManager: Error deleting note:", e.target.error);
                    reject(e.target.error);
                };
            }).catch(err => {
                console.error("StorageManager: DB init failed before deleting note:", err);
                reject(err);
            });
        });
    }

    clearNotes(storeName) {
        return new Promise((resolve, reject) => {
            this.initDB(storeName).then(() => {
                const store = this._getStore(storeName, 'readwrite');
                const request = store.clear();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("StorageManager: Error clearing notes:", e.target.error);
                    reject(e.target.error);
                };
            }).catch(err => {
                console.error("StorageManager: DB init failed before clearing notes:", err);
                reject(err);
            });
        });
    }
}

/**
 * NotesManager Class
 */
class NotesManager {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.ui = {
            noteText: $('#application-note-text'),
            saveBtn: $('#save-note-btn'),
            loadBtn: $('#load-notes-btn'),
            clearBtn: $('#clear-notes-btn'),
            notesList: $('#notes-list')
        };
        // console.log("NotesManager initialized"); // Removed
    }

    init() {
        this.storageManager.initDB('notes')
            .then(() => {
                // console.log("NotesManager: DB initialized successfully."); // Can be removed
                this.attachEventListeners();
                this.loadAndDisplayNotes();
            })
            .catch(error => {
                console.error("NotesManager: Failed to initialize DB for notes.", error);
                this.ui.notesList.html('<li>Error: Could not load notes. Database initialization failed.</li>');
                this.ui.saveBtn.prop('disabled', true).addClass('disabled');
                this.ui.loadBtn.prop('disabled', true).addClass('disabled');
                this.ui.clearBtn.prop('disabled', true).addClass('disabled');
            });
    }

    attachEventListeners() {
        this.ui.saveBtn.on('click', () => this.saveCurrentNote());
        this.ui.loadBtn.on('click', () => this.loadAndDisplayNotes());
        this.ui.clearBtn.on('click', () => this.clearAllNotes());
        this.ui.notesList.on('click', '.delete-note-btn', (event) => {
            const noteId = $(event.currentTarget).data('id');
            if (noteId && confirm('Are you sure you want to delete this note?')) {
                this.deleteNoteById(Number(noteId));
            }
        });
    }

    saveCurrentNote() {
        const text = this.ui.noteText.val().trim();
        if (!text) {
            alert("Note cannot be empty."); // Simple validation
            return;
        }
        this.storageManager.saveNote(text, 'notes')
            .then(() => {
                this.ui.noteText.val('');
                this.loadAndDisplayNotes();
            })
            .catch(error => console.error("NotesManager: Error saving note:", error));
    }

    loadAndDisplayNotes() {
        this.storageManager.loadNotes('notes')
            .then(notes => this.displayNotes(notes))
            .catch(error => {
                console.error("NotesManager: Error loading notes:", error);
                this.ui.notesList.html('<li>Error loading notes. Please try refreshing.</li>');
            });
    }

    displayNotes(notes) {
        this.ui.notesList.empty();
        if (!notes || notes.length === 0) {
            this.ui.notesList.append('<li>No notes saved yet.</li>');
            return;
        }
        notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        notes.forEach(note => {
            const formattedTimestamp = new Date(note.timestamp).toLocaleString();
            const listItem = `
                <li>
                    <div class="note-content-display">
                        <span class="note-timestamp">${formattedTimestamp}</span>
                        <p class="note-text">${this.escapeHtml(note.text)}</p>
                    </div>
                    <div class="note-actions">
                        <button class="delete-note-btn" data-id="${note.id}">Delete</button>
                    </div>
                </li>`;
            this.ui.notesList.append(listItem);
        });
    }
    
    escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return String(unsafe)
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    deleteNoteById(noteId) {
        this.storageManager.deleteNote(noteId, 'notes')
            .then(() => this.loadAndDisplayNotes())
            .catch(error => console.error(`NotesManager: Error deleting note ${noteId}:`, error));
    }

    clearAllNotes() {
        if (confirm("Are you sure you want to delete ALL notes? This action cannot be undone.")) {
            this.storageManager.clearNotes('notes')
                .then(() => this.loadAndDisplayNotes())
                .catch(error => console.error("NotesManager: Error clearing all notes:", error));
        }
    }
}

/**
 * ContentLoader Class
 */
class ContentLoader {
    constructor() {
        // console.log('ContentLoader initialized'); // Removed
    }

    loadJson(url) {
        if (typeof $ === 'undefined' || !$.getJSON) {
            console.error('ContentLoader: jQuery or $.getJSON is not available.');
            return $.Deferred().reject('jQuery not available').promise();
        }

        return $.getJSON(url)
            .fail((jqXHR, textStatus, errorThrown) => {
                // Error already logged by App.loadCompanyValues, but this is fine for module-level debug
                // console.error(`ContentLoader: Failed to load JSON from ${url}: ${textStatus}`, errorThrown);
            });
    }
}

// Instantiate and initialize the App when the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    // console.log("DOM fully loaded and parsed"); // Can be removed, or kept for initial load check
    if (typeof $ === 'undefined') {
        console.error("jQuery is not loaded! Critical features might not work.");
        document.body.insertAdjacentHTML('afterbegin', '<div style="background-color: red; color: white; padding: 10px; text-align: center; position:fixed; top:0; left:0; width:100%; z-index:9999;">Error: jQuery is not loaded. Some page features may not work.</div>');
        return;
    }
    const app = new App();
    app.init();
});
