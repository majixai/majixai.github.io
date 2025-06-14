document.addEventListener('DOMContentLoaded', () => {
    // Data structure placeholders
    // Contact: { id, name, email, phone, linkedEventIds: [] }
    // Iframe: { id, url, title, linkedEventIds: [] }
    // Note: { id, title, content, linkedEventIds: [] }
    // CalendarEvent: { id, date, description, contactIds: [], iframeIds: [], noteIds: [] }
    // DetailedTradingSignal: { id, platform, pair, direction, duration, tradeValue, timeLimit, access, added, rawText }
    // TieredTradingSignal: { id, platform, product, direction, orderTimeLimit, tradeStyle, tiers: [{duration, profit, minAmount}], added, rawText }
    // PositionUpdate: { id, platform, asset, price, profit, added, rawText }
    // PlatformInvite: { id, platform, link, message, added, rawText }

    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const addLinkForm = document.querySelector('form'); // This is for links, might need to be more specific if IDs are generic
    const linkList = document.getElementById('linkList');

    // DOM elements for Contacts
    const contactForm = document.getElementById('contactForm');
    const contactNameInput = document.getElementById('contactNameInput'); // Assuming ID 'contactNameInput'
    const contactEmailInput = document.getElementById('contactEmailInput'); // Assuming ID 'contactEmailInput'
    const contactPhoneInput = document.getElementById('contactPhoneInput'); // Assuming ID 'contactPhoneInput'
    const contactList = document.getElementById('contactList');

    // DOM elements for Iframes
    const iframeForm = document.getElementById('iframeForm');
    const iframeUrlInput = document.getElementById('iframeUrlInput');
    const iframeTitleInput = document.getElementById('iframeTitleInput');
    const iframeDisplayArea = document.getElementById('iframeDisplayArea');

    // DOM elements for Notes
    const noteForm = document.getElementById('noteForm');
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteContentInput = document.getElementById('noteContentInput');
    const noteList = document.getElementById('noteList');
    // Assuming the submit button in the note form has id="noteSubmitButton"
    const noteSubmitButton = document.getElementById('noteSubmitButton');
    // A cancel button can be added to the HTML or created dynamically.
    // For simplicity, let's assume there's a <button id="cancelEditNoteButton" style="display:none;">Cancel Edit</button> in the form.
    const cancelEditNoteButton = document.getElementById('cancelEditNoteButton');

    let currentEditingNoteId = null; // To track if we are editing a note

    // DOM elements for Calendar Events
    const calendarEventForm = document.getElementById('calendarEventForm');
    const calendarEventDateInput = document.getElementById('calendarEventDateInput');
    const calendarEventDescriptionInput = document.getElementById('calendarEventDescriptionInput');
    const calendarEventList = document.getElementById('calendarEventList');

    // DOM elements for Detailed Trading Signals
    const detailedTradingSignalForm = document.getElementById('detailedTradingSignalForm');
    const detailedSignalPlatformInput = document.getElementById('detailedSignalPlatformInput');
    const detailedSignalPairInput = document.getElementById('detailedSignalPairInput');
    const detailedSignalDirectionInput = document.getElementById('detailedSignalDirectionInput');
    const detailedSignalDurationInput = document.getElementById('detailedSignalDurationInput');
    const detailedSignalTradeValueInput = document.getElementById('detailedSignalTradeValueInput');
    const detailedSignalTimeLimitInput = document.getElementById('detailedSignalTimeLimitInput');
    const detailedSignalAccessInput = document.getElementById('detailedSignalAccessInput');
    const detailedSignalRawTextInput = document.getElementById('detailedSignalRawTextInput');
    const detailedTradingSignalList = document.getElementById('detailedTradingSignalList');

    // DOM elements for Tiered Trading Signals
    const tieredTradingSignalForm = document.getElementById('tieredTradingSignalForm');
    const tieredSignalPlatformInput = document.getElementById('tieredSignalPlatformInput');
    const tieredSignalProductInput = document.getElementById('tieredSignalProductInput');
    const tieredSignalDirectionInput = document.getElementById('tieredSignalDirectionInput');
    const tieredSignalOrderTimeLimitInput = document.getElementById('tieredSignalOrderTimeLimitInput');
    const tieredSignalTradeStyleInput = document.getElementById('tieredSignalTradeStyleInput');
    const tieredSignalTiersInput = document.getElementById('tieredSignalTiersInput'); // Textarea for tiers
    const tieredSignalRawTextInput = document.getElementById('tieredSignalRawTextInput');
    const tieredTradingSignalList = document.getElementById('tieredTradingSignalList');

    // DOM elements for Position Updates
    const positionUpdateForm = document.getElementById('positionUpdateForm');
    const positionUpdatePlatformInput = document.getElementById('positionUpdatePlatformInput');
    const positionUpdateAssetInput = document.getElementById('positionUpdateAssetInput');
    const positionUpdatePriceInput = document.getElementById('positionUpdatePriceInput');
    const positionUpdateProfitInput = document.getElementById('positionUpdateProfitInput');
    const positionUpdateRawTextInput = document.getElementById('positionUpdateRawTextInput');
    const positionUpdateList = document.getElementById('positionUpdateList');

    // DOM elements for Platform Invites
    const platformInviteForm = document.getElementById('platformInviteForm');
    const platformInviteNameInput = document.getElementById('platformInviteNameInput'); // Corrected from platformInvitePlatformInput to platformInviteNameInput as per HTML
    const platformInviteLinkInput = document.getElementById('platformInviteLinkInput');
    const platformInviteMessageInput = document.getElementById('platformInviteMessageInput');
    const platformInviteRawTextInput = document.getElementById('platformInviteRawTextInput');
    const platformInviteList = document.getElementById('platformInviteList');

    let db;
    const dbName = 'LinkIndexerDB';
    const storeName = 'links'; // Keep this for the existing links functionality

    // Define names for new stores
    const contactsStoreName = 'contacts';
    const iframesStoreName = 'iframes';
    const notesStoreName = 'notes';
    const calendarEventsStoreName = 'calendarEvents';
    const detailedTradingSignalsStoreName = 'detailedTradingSignals';
    const tieredTradingSignalsStoreName = 'tieredTradingSignals';
    const positionUpdatesStoreName = 'positionUpdates';
    const platformInvitesStoreName = 'platformInvites';

    // 1. Initialize IndexedDB - Increment version to 3
    const request = indexedDB.open(dbName, 3);

    request.onerror = (event) => {
        console.error('Database error:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;

        // Existing 'links' store
        if (!db.objectStoreNames.contains(storeName)) {
            const linkStore = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            linkStore.createIndex('url', 'url', { unique: false });
            console.log('Object store created:', storeName);
        }

        // New 'contacts' store
        if (!db.objectStoreNames.contains(contactsStoreName)) {
            const contactsStore = db.createObjectStore(contactsStoreName, { keyPath: 'id', autoIncrement: true });
            contactsStore.createIndex('name', 'name', { unique: false });
            console.log('Object store created:', contactsStoreName);
        }

        // New 'iframes' store
        if (!db.objectStoreNames.contains(iframesStoreName)) {
            const iframesStore = db.createObjectStore(iframesStoreName, { keyPath: 'id', autoIncrement: true });
            iframesStore.createIndex('title', 'title', { unique: false });
            console.log('Object store created:', iframesStoreName);
        }

        // New 'notes' store
        if (!db.objectStoreNames.contains(notesStoreName)) {
            const notesStore = db.createObjectStore(notesStoreName, { keyPath: 'id', autoIncrement: true });
            notesStore.createIndex('title', 'title', { unique: false });
            console.log('Object store created:', notesStoreName);
        }

        // New 'calendarEvents' store
        if (!db.objectStoreNames.contains(calendarEventsStoreName)) {
            const calendarEventsStore = db.createObjectStore(calendarEventsStoreName, { keyPath: 'id', autoIncrement: true });
            calendarEventsStore.createIndex('date', 'date', { unique: false });
            console.log('Object store created:', calendarEventsStoreName);
        }

        if (!db.objectStoreNames.contains(detailedTradingSignalsStoreName)) {
            const detailedTradingSignalStore = db.createObjectStore(detailedTradingSignalsStoreName, { keyPath: 'id', autoIncrement: true });
            detailedTradingSignalStore.createIndex('platform', 'platform', { unique: false });
            detailedTradingSignalStore.createIndex('added', 'added', { unique: false });
            console.log('Object store created:', detailedTradingSignalsStoreName);
        }

        if (!db.objectStoreNames.contains(tieredTradingSignalsStoreName)) {
            const tieredTradingSignalStore = db.createObjectStore(tieredTradingSignalsStoreName, { keyPath: 'id', autoIncrement: true });
            tieredTradingSignalStore.createIndex('platform', 'platform', { unique: false });
            tieredTradingSignalStore.createIndex('added', 'added', { unique: false });
            console.log('Object store created:', tieredTradingSignalsStoreName);
        }

        if (!db.objectStoreNames.contains(positionUpdatesStoreName)) {
            const positionUpdateStore = db.createObjectStore(positionUpdatesStoreName, { keyPath: 'id', autoIncrement: true });
            positionUpdateStore.createIndex('platform', 'platform', { unique: false });
            positionUpdateStore.createIndex('added', 'added', { unique: false });
            console.log('Object store created:', positionUpdatesStoreName);
        }

        if (!db.objectStoreNames.contains(platformInvitesStoreName)) {
            const platformInviteStore = db.createObjectStore(platformInvitesStoreName, { keyPath: 'id', autoIncrement: true });
            platformInviteStore.createIndex('platform', 'platform', { unique: false });
            platformInviteStore.createIndex('added', 'added', { unique: false });
            console.log('Object store created:', platformInvitesStoreName);
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database opened successfully:', dbName);
        displayLinks();
        displayContacts(); // Initial display of contacts
        displayIframes(); // Initial display of iframes
        displayNotes(); // Initial display of notes
        displayCalendarEvents(); // Initial display of calendar events
        displayDetailedTradingSignals();
        displayTieredTradingSignals();
        displayPositionUpdates();
        displayPlatformInvites();
    };

    // 2. Handle Link form submission
    if (addLinkForm) { // Ensure link form exists before adding listener
        addLinkForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const url = urlInput.value.trim();
            const title = titleInput.value.trim();

            if (url && title) {
                addLink(url, title);
                urlInput.value = '';
                titleInput.value = '';
            } else {
                alert('Please enter both URL and Title.');
            }
        });
    }


    // START: Contact CRUD Functionality

    // Handle Contact form submission
    if (contactForm) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = contactNameInput.value.trim();
            const email = contactEmailInput.value.trim();
            const phone = contactPhoneInput.value.trim();

            if (name && email) { // Phone is optional for this example
                addContact(name, email, phone);
                contactNameInput.value = '';
                contactEmailInput.value = '';
                contactPhoneInput.value = '';
            } else {
                alert('Please enter at least Name and Email for the contact.');
            }
        });
    }

    function addContact(name, email, phone) {
        if (!db) {
            console.error('Database not initialized for adding contact.');
            return;
        }
        const transaction = db.transaction([contactsStoreName], 'readwrite');
        const store = transaction.objectStore(contactsStoreName);
        // Ensure linkedEventIds array is present
        const contact = { name, email, phone, added: new Date(), linkedEventIds: [] };

        const request = store.add(contact);

        request.onsuccess = () => {
            console.log('Contact added successfully:', contact);
            displayContacts(); // Refresh the list
        };

        request.onerror = (event) => {
            console.error('Error adding contact:', event.target.error);
        };
    }

    function displayContacts() {
        if (!db) {
            console.error('Database not initialized for displaying contacts.');
            if(contactList) contactList.innerHTML = '<li>Database not ready.</li>';
            return;
        }
        if (!contactList) return;
        contactList.innerHTML = '';

        const transaction = db.transaction([contactsStoreName], 'readonly');
        const store = transaction.objectStore(contactsStoreName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const contacts = event.target.result;
            if (contacts && contacts.length > 0) {
                contacts.forEach(contact => {
                    const listItem = document.createElement('li');
                    let content = `Name: ${contact.name}, Email: ${contact.email}, Phone: ${contact.phone || 'N/A'}`;
                    if (contact.linkedEventIds && contact.linkedEventIds.length > 0) {
                        content += ` | Linked Event IDs: ${contact.linkedEventIds.join(', ')}`;
                    } else {
                        content += ` | Linked Event IDs: None`;
                    }
                    listItem.textContent = content;

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';
                    deleteButton.classList.add('delete-contact-btn');
                    deleteButton.dataset.id = contact.id;
                    deleteButton.addEventListener('click', function() {
                        const idToDelete = parseInt(this.dataset.id, 10);
                        deleteContact(idToDelete);
                    });

                    listItem.appendChild(deleteButton);
                    contactList.appendChild(listItem);
                });
            } else {
                contactList.innerHTML = '<li>No contacts stored yet.</li>';
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving contacts:', event.target.error);
            contactList.innerHTML = '<li>Error loading contacts.</li>';
        };
    }

    function deleteContact(contactId) {
        if (isNaN(contactId)) {
            console.error('Invalid contact ID for deletion.');
            return;
        }
        if (!db) {
            console.error('Database not initialized for deleting contact.');
            return;
        }

        const transaction = db.transaction([contactsStoreName], 'readwrite');
        const store = transaction.objectStore(contactsStoreName);
        const request = store.delete(contactId);

        request.onsuccess = () => {
            console.log('Contact deleted successfully:', contactId);
            displayContacts(); // Refresh the list
            // TODO: When a contact is deleted, iterate through all calendarEvents.
            // If an event's contactIds array contains contactId, remove it and put the event.
        };

        request.onerror = (event) => {
            console.error('Error deleting contact:', event.target.error);
        };
    }
    // END: Contact CRUD Functionality


    // START: Iframe CRUD Functionality

    // Handle Iframe form submission
    if (iframeForm) {
        iframeForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const url = iframeUrlInput.value.trim();
            const title = iframeTitleInput.value.trim();

            if (url && title) {
                addIframe(url, title);
                iframeUrlInput.value = '';
                iframeTitleInput.value = '';
            } else {
                alert('Please enter both URL and Title for the iframe.');
            }
        });
    }

    function addIframe(url, title) {
        if (!db) {
            console.error('Database not initialized for adding iframe.');
            return;
        }
        const transaction = db.transaction([iframesStoreName], 'readwrite');
        const store = transaction.objectStore(iframesStoreName);
        // Ensure linkedEventIds array is present
        const iframeData = { url, title, added: new Date(), linkedEventIds: [] };

        const request = store.add(iframeData);

        request.onsuccess = () => {
            console.log('Iframe added successfully:', iframeData);
            displayIframes(); // Refresh the display area
        };

        request.onerror = (event) => {
            console.error('Error adding iframe:', event.target.error);
        };
    }

    function displayIframes() {
        if (!db) {
            console.error('Database not initialized for displaying iframes.');
            if (iframeDisplayArea) iframeDisplayArea.innerHTML = '<p>Database not ready.</p>';
            return;
        }
        if (!iframeDisplayArea) return;
        iframeDisplayArea.innerHTML = '';

        const transaction = db.transaction([iframesStoreName], 'readonly');
        const store = transaction.objectStore(iframesStoreName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const iframes = event.target.result;
            if (iframes && iframes.length > 0) {
                iframes.forEach(iframe => {
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('iframe-item'); // For potential styling

                    const titleEl = document.createElement('h4');
                    titleEl.textContent = iframe.title;

                    const urlEl = document.createElement('p');
                    let urlContent = `URL: ${iframe.url}`;
                    if (iframe.linkedEventIds && iframe.linkedEventIds.length > 0) {
                        urlContent += ` | Linked Event IDs: ${iframe.linkedEventIds.join(', ')}`;
                    } else {
                        urlContent += ` | Linked Event IDs: None`;
                    }
                    urlEl.textContent = urlContent;

                    // Optional: Display the actual iframe (use with caution due to security and layout implications)
                    // const iframeEl = document.createElement('iframe');
                    // iframeEl.src = iframe.url;
                    // iframeEl.title = iframe.title;
                    // iframeEl.width = "600"; // Example width
                    // iframeEl.height = "400"; // Example height
                    // itemDiv.appendChild(iframeEl);


                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete Iframe';
                    deleteButton.classList.add('delete-iframe-btn');
                    deleteButton.dataset.id = iframe.id;
                    deleteButton.addEventListener('click', function() {
                        const idToDelete = parseInt(this.dataset.id, 10);
                        deleteIframe(idToDelete);
                    });

                    itemDiv.appendChild(titleEl);
                    itemDiv.appendChild(urlEl);
                    itemDiv.appendChild(deleteButton);
                    iframeDisplayArea.appendChild(itemDiv);
                });
            } else {
                iframeDisplayArea.innerHTML = '<p>No iframes stored yet.</p>';
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving iframes:', event.target.error);
            iframeDisplayArea.innerHTML = '<p>Error loading iframes.</p>';
        };
    }

    function deleteIframe(iframeId) {
        if (isNaN(iframeId)) {
            console.error('Invalid iframe ID for deletion.');
            return;
        }
        if (!db) {
            console.error('Database not initialized for deleting iframe.');
            return;
        }

        const transaction = db.transaction([iframesStoreName], 'readwrite');
        const store = transaction.objectStore(iframesStoreName);
        const request = store.delete(iframeId);

        request.onsuccess = () => {
            console.log('Iframe deleted successfully:', iframeId);
            displayIframes(); // Refresh the display area
            // TODO: When an iframe is deleted, iterate through all calendarEvents.
            // If an event's iframeIds array contains iframeId, remove it and put the event.
        };

        request.onerror = (event) => {
            console.error('Error deleting iframe:', event.target.error);
        };
    }
    // END: Iframe CRUD Functionality


    // START: Notes CRUD Functionality
    if (noteForm) {
        noteForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const title = noteTitleInput.value.trim();
            const content = noteContentInput.value.trim();

            if (title && content) {
                if (currentEditingNoteId !== null) {
                    updateNote(currentEditingNoteId, title, content);
                } else {
                    addNote(title, content);
                }
                noteTitleInput.value = '';
                noteContentInput.value = '';
                // Reset form state after add/update is handled by specific functions
            } else {
                alert('Please enter both Title and Content for the note.');
            }
        });
    }

    if (cancelEditNoteButton) {
        cancelEditNoteButton.addEventListener('click', () => {
            resetNoteFormState();
        });
    }

    function resetNoteFormState() {
        currentEditingNoteId = null;
        noteTitleInput.value = '';
        noteContentInput.value = '';
        if (noteSubmitButton) noteSubmitButton.textContent = 'Add Note';
        if (cancelEditNoteButton) cancelEditNoteButton.style.display = 'none';
    }

    function addNote(title, content) {
        if (!db) {
            console.error('Database not initialized for adding note.');
            return;
        }
        const transaction = db.transaction([notesStoreName], 'readwrite');
        const store = transaction.objectStore(notesStoreName);
        // Ensure linkedEventIds array is present
        const note = { title, content, added: new Date(), lastModified: new Date(), linkedEventIds: [] };

        const request = store.add(note);

        request.onsuccess = () => {
            console.log('Note added successfully:', note);
            displayNotes();
            resetNoteFormState(); // Clear form and reset editing state
        };

        request.onerror = (event) => {
            console.error('Error adding note:', event.target.error);
        };
    }

    function displayNotes() {
        if (!db) {
            console.error('Database not initialized for displaying notes.');
            if (noteList) noteList.innerHTML = '<li>Database not ready.</li>';
            return;
        }
        if (!noteList) return;
        noteList.innerHTML = '';

        const transaction = db.transaction([notesStoreName], 'readonly');
        const store = transaction.objectStore(notesStoreName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const notes = event.target.result;
            if (notes && notes.length > 0) {
                notes.sort((a,b) => new Date(b.lastModified) - new Date(a.lastModified)); // Display newest first
                notes.forEach(note => {
                    const listItem = document.createElement('li');

                    const titleEl = document.createElement('h3');
                    titleEl.textContent = note.title;

                    const contentEl = document.createElement('p');
                    contentEl.textContent = note.content;
                    // Simple line break handling, replace \n with <br>
                    contentEl.innerHTML = note.content.replace(/\n/g, '<br>');


                    const addedDate = new Date(note.added).toLocaleString();
                    const modifiedDate = new Date(note.lastModified).toLocaleString();
                    const dateInfo = document.createElement('small');
                    let dateText = `Added: ${addedDate} | Modified: ${modifiedDate}`;
                    if (note.linkedEventIds && note.linkedEventIds.length > 0) {
                        dateText += ` | Linked Event IDs: ${note.linkedEventIds.join(', ')}`;
                    } else {
                        dateText += ` | Linked Event IDs: None`;
                    }
                    dateInfo.textContent = dateText;
                    dateInfo.style.display = 'block';
                    dateInfo.style.marginTop = '5px';

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';
                    deleteButton.classList.add('delete-note-btn');
                    deleteButton.dataset.id = note.id;
                    deleteButton.addEventListener('click', function() {
                        deleteNote(parseInt(this.dataset.id, 10));
                    });

                    const editButton = document.createElement('button');
                    editButton.textContent = 'Edit';
                    editButton.classList.add('edit-note-btn');
                    // Pass the whole note object to handleEditNote
                    editButton.addEventListener('click', function() {
                        handleEditNote(note);
                    });

                    listItem.appendChild(titleEl);
                    listItem.appendChild(contentEl);
                    listItem.appendChild(dateInfo);
                    listItem.appendChild(editButton);
                    listItem.appendChild(deleteButton);
                    noteList.appendChild(listItem);
                });
            } else {
                noteList.innerHTML = '<li>No notes stored yet.</li>';
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving notes:', event.target.error);
            noteList.innerHTML = '<li>Error loading notes.</li>';
        };
    }

    function deleteNote(noteId) {
        if (isNaN(noteId)) {
            console.error('Invalid note ID for deletion.');
            return;
        }
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction([notesStoreName], 'readwrite');
        const store = transaction.objectStore(notesStoreName);
        const request = store.delete(noteId);

        request.onsuccess = () => {
            console.log('Note deleted successfully:', noteId);
            displayNotes();
            if (currentEditingNoteId === noteId) {
                resetNoteFormState();
            }
            // TODO: When a note is deleted, iterate through all calendarEvents.
            // If an event's noteIds array contains noteId, remove it and put the event.
        };
        request.onerror = (event) => {
            console.error('Error deleting note:', event.target.error);
        };
    }

    function handleEditNote(note) {
        if (!noteTitleInput || !noteContentInput || !noteSubmitButton || !cancelEditNoteButton) {
            console.error("Note form elements not found for editing.");
            return;
        }
        noteTitleInput.value = note.title;
        noteContentInput.value = note.content;
        currentEditingNoteId = note.id;
        noteSubmitButton.textContent = 'Update Note';
        cancelEditNoteButton.style.display = 'inline-block'; // Show cancel button
        noteTitleInput.focus(); // Focus on title input
    }

    function updateNote(noteId, title, content) {
        if (!db) {
            console.error('Database not initialized for updating note.');
            return;
        }
        const transaction = db.transaction([notesStoreName], 'readwrite');
        const store = transaction.objectStore(notesStoreName);
        const getRequest = store.get(noteId);

        getRequest.onsuccess = () => {
            const noteToUpdate = getRequest.result;
            if (noteToUpdate) {
                noteToUpdate.title = title;
                noteToUpdate.content = content;
                noteToUpdate.lastModified = new Date();
                // noteToUpdate.linkedEventIds is preserved as it was, or could be updated here if UI existed

                const putRequest = store.put(noteToUpdate);
                putRequest.onsuccess = () => {
                    console.log('Note updated successfully:', noteToUpdate);
                    displayNotes();
                    resetNoteFormState(); // Reset form after successful update
                };
                putRequest.onerror = (event) => {
                    console.error('Error updating note (put):', event.target.error);
                };
            } else {
                console.error('Note not found for updating (get):', noteId);
            }
        };
        getRequest.onerror = (event) => {
            console.error('Error retrieving note for update (get):', event.target.error);
        };
    }

    // END: Notes CRUD Functionality


    // START: Calendar Event CRUD Functionality
    if (calendarEventForm) {
        calendarEventForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const date = calendarEventDateInput.value;
            const description = calendarEventDescriptionInput.value.trim();

            if (date && description) {
                addCalendarEvent(date, description);
                calendarEventDateInput.value = '';
                calendarEventDescriptionInput.value = '';
            } else {
                alert('Please enter both Date and Description for the event.');
            }
        });
    }

    function addCalendarEvent(date, description) {
        if (!db) {
            console.error('Database not initialized for adding calendar event.');
            return;
        }
        const transaction = db.transaction([calendarEventsStoreName], 'readwrite');
        const store = transaction.objectStore(calendarEventsStoreName);
        const event = {
            date,
            description,
            added: new Date(),
            contactIds: [],
            iframeIds: [],
            noteIds: []
        };

        const request = store.add(event);

        request.onsuccess = () => {
            console.log('Calendar event added successfully:', event);
            displayCalendarEvents();
        };

        request.onerror = (event) => {
            console.error('Error adding calendar event:', event.target.error);
        };
    }

    function displayCalendarEvents() {
        if (!db) {
            console.error('Database not initialized for displaying calendar events.');
            if (calendarEventList) calendarEventList.innerHTML = '<li>Database not ready.</li>';
            return;
        }
        if (!calendarEventList) return;
        calendarEventList.innerHTML = '';

        const transaction = db.transaction([calendarEventsStoreName], 'readonly');
        const store = transaction.objectStore(calendarEventsStoreName);
        const request = store.getAll(); // Consider store.index('date').getAll() for sorting

        request.onsuccess = (event) => {
            const events = event.target.result;
            if (events && events.length > 0) {
                // Optional: sort by date if not using index
                events.sort((a,b) => new Date(a.date) - new Date(b.date));

                events.forEach(event => {
                    const listItem = document.createElement('li');
                    let content = `Date: ${new Date(event.date).toLocaleDateString()}, Description: ${event.description}`;
                    content += `<br><small>Linked Contacts: ${event.contactIds.length > 0 ? event.contactIds.join(', ') : 'None'}</small>`;
                    content += `<br><small>Linked Iframes: ${event.iframeIds.length > 0 ? event.iframeIds.join(', ') : 'None'}</small>`;
                    content += `<br><small>Linked Notes: ${event.noteIds.length > 0 ? event.noteIds.join(', ') : 'None'}</small>`;
                    listItem.innerHTML = content;

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete Event';
                    deleteButton.classList.add('delete-event-btn');
                    deleteButton.dataset.id = event.id;
                    deleteButton.addEventListener('click', function() {
                        deleteCalendarEvent(parseInt(this.dataset.id, 10));
                    });

                    listItem.appendChild(deleteButton);
                    calendarEventList.appendChild(listItem);
                });
            } else {
                calendarEventList.innerHTML = '<li>No events scheduled.</li>';
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving calendar events:', event.target.error);
            calendarEventList.innerHTML = '<li>Error loading events.</li>';
        };
    }

    function deleteCalendarEvent(eventId) {
        if (isNaN(eventId)) {
            console.error('Invalid event ID for deletion.');
            return;
        }
        if (!db) {
            console.error('Database not initialized.');
            return;
        }

        const transaction = db.transaction([calendarEventsStoreName], 'readwrite');
        const store = transaction.objectStore(calendarEventsStoreName);
        const request = store.delete(eventId);

        request.onsuccess = () => {
            console.log('Calendar event deleted successfully:', eventId);
            displayCalendarEvents();
            // TODO: Complex link cleanup
            // Iterate through contacts, iframes, notes. If any are linked to this eventId,
            // remove the eventId from their linkedEventIds array and save them.
            // This requires careful transaction management across multiple stores.
            // Example for one store (contacts):
            /*
            const contactTx = db.transaction([contactsStoreName], 'readwrite');
            const contactStore = contactTx.objectStore(contactsStoreName);
            const getAllContactsReq = contactStore.getAll();
            getAllContactsReq.onsuccess = () => {
                getAllContactsReq.result.forEach(contact => {
                    const index = contact.linkedEventIds.indexOf(eventId);
                    if (index > -1) {
                        contact.linkedEventIds.splice(index, 1);
                        contactStore.put(contact); // No need for display update from here
                    }
                });
            };
            */
            // Repeat for iframesStoreName and notesStoreName.
        };

        request.onerror = (event) => {
            console.error('Error deleting calendar event:', event.target.error);
        };
    }
    // END: Calendar Event CRUD Functionality


    // The following addLinkForm listener was identified as a duplicate and removed in the previous step.
    // It's kept here in comments for reference during this multi-turn process, but should not be re-introduced.
    // addLinkForm.addEventListener('submit', (event) => {
    // event.preventDefault();
    // const url = urlInput.value.trim();
    // const title = titleInput.value.trim();
    //
    // // This is a duplicate of the addLinkForm event listener, removing it.
    // // The original addLinkForm listener is now wrapped in an if (addLinkForm) check.
    // });

    function addLink(url, title) {
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const link = { url, title, added: new Date() };

        const request = store.add(link);

        request.onsuccess = () => {
            console.log('Link added successfully:', link);
            displayLinks(); // Refresh the list
        };

        request.onerror = (event) => {
            console.error('Error adding link:', event.target.error);
            if (event.target.error.name === 'ConstraintError') {
                alert('A link with this URL already exists.'); // Only if 'url' index is unique
            }
        };
    }

    // 3. Display links
    function displayLinks() {
        if (!db) {
            console.error('Database not initialized for displaying links.');
            return;
        }
        linkList.innerHTML = ''; // Clear existing list

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const links = event.target.result;
            if (links && links.length > 0) {
                links.forEach(link => {
                    const listItem = document.createElement('li');

                    const a = document.createElement('a');
                    a.href = link.url;
                    a.textContent = link.title;
                    a.target = '_blank'; // Open in new tab

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';
                    deleteButton.classList.add('delete-btn');
                    deleteButton.dataset.id = link.id;
                    deleteButton.addEventListener('click', deleteLink);

                    listItem.appendChild(a);
                    listItem.appendChild(deleteButton);
                    linkList.appendChild(listItem);
                });
            } else {
                linkList.innerHTML = '<li>No links stored yet.</li>';
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving links:', event.target.error);
            linkList.innerHTML = '<li>Error loading links.</li>';
        };
    }

    // 4. Handle link deletion
    function deleteLink(eventOrId) { // Modified to accept event or ID
        let linkId;
        if (typeof eventOrId === 'number') {
            linkId = eventOrId;
        } else if (eventOrId && eventOrId.target && eventOrId.target.dataset) {
            linkId = parseInt(eventOrId.target.dataset.id, 10);
        }

        if (isNaN(linkId)) {
            console.error('Invalid link ID for deletion.');
            return;
        }

        if (!db) {
            console.error('Database not initialized for deleting link.');
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(linkId);

        request.onsuccess = () => {
            console.log('Link deleted successfully:', linkId);
            displayLinks(); // Refresh the list
        };

        request.onerror = (event) => {
            console.error('Error deleting link:', event.target.error);
        };
    }

    function displayDetailedTradingSignals() {
        // Placeholder: Implementation will be in a future step
        // console.log('displayDetailedTradingSignals called');
    if (!db || !detailedTradingSignalList) {
        console.error('Database or list element not ready for Detailed Trading Signals.');
        if (detailedTradingSignalList) detailedTradingSignalList.innerHTML = '<li>Database not ready or list element missing.</li>';
        return;
    }
    detailedTradingSignalList.innerHTML = '';

    const transaction = db.transaction([detailedTradingSignalsStoreName], 'readonly');
    const store = transaction.objectStore(detailedTradingSignalsStoreName);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const signals = event.target.result;
        if (signals && signals.length > 0) {
            signals.forEach(signal => {
                const listItem = document.createElement('li');
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = `
                    <div><strong>Platform:</strong> ${signal.platform}</div>
                    <div><strong>Pair:</strong> ${signal.pair}</div>
                    <div><strong>Direction:</strong> ${signal.direction}</div>
                    ${signal.duration ? `<div><strong>Duration:</strong> ${signal.duration}</div>` : ''}
                    ${signal.tradeValue ? `<div><strong>Trade Value:</strong> ${signal.tradeValue}</div>` : ''}
                    ${signal.timeLimit ? `<div><strong>Time Limit:</strong> ${signal.timeLimit}</div>` : ''}
                    ${signal.access ? `<div><strong>Access:</strong> ${signal.access}</div>` : ''}
                    <div><strong>Added:</strong> ${new Date(signal.added).toLocaleString()}</div>
                `;
                listItem.appendChild(contentDiv);

                const rawTextDiv = document.createElement('div');
                rawTextDiv.textContent = signal.rawText;
                rawTextDiv.classList.add('raw-text-display');
                listItem.appendChild(rawTextDiv);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete Signal';
                deleteButton.dataset.id = signal.id;
                deleteButton.addEventListener('click', () => deleteDetailedTradingSignal(signal.id));
                listItem.appendChild(deleteButton);
                detailedTradingSignalList.appendChild(listItem);
            });
        } else {
            detailedTradingSignalList.innerHTML = '<li>No detailed trading signals stored yet.</li>';
        }
    };

    request.onerror = (event) => {
        console.error('Error retrieving detailed trading signals:', event.target.error);
        detailedTradingSignalList.innerHTML = '<li>Error loading detailed trading signals.</li>';
    };
}

function deleteDetailedTradingSignal(signalId) {
    if (!db) {
        console.error('Database not initialized for deleting detailed trading signal.');
        return;
    }
    const transaction = db.transaction([detailedTradingSignalsStoreName], 'readwrite');
    const store = transaction.objectStore(detailedTradingSignalsStoreName);
    const request = store.delete(signalId);

    request.onsuccess = () => {
        console.log('Detailed trading signal deleted successfully:', signalId);
        displayDetailedTradingSignals();
    };
    request.onerror = (event) => {
        console.error('Error deleting detailed trading signal:', event.target.error);
    };
    }

    function displayTieredTradingSignals() {
        // console.log('displayTieredTradingSignals called');
    if (!db || !tieredTradingSignalList) {
        console.error('Database or list element not ready for Tiered Trading Signals.');
        if (tieredTradingSignalList) tieredTradingSignalList.innerHTML = '<li>Database not ready or list element missing.</li>';
        return;
    }
    tieredTradingSignalList.innerHTML = '';

    const transaction = db.transaction([tieredTradingSignalsStoreName], 'readonly');
    const store = transaction.objectStore(tieredTradingSignalsStoreName);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const signals = event.target.result;
        if (signals && signals.length > 0) {
            signals.forEach(signal => {
                const listItem = document.createElement('li');
                let tiersHTML = '<strong>Tiers:</strong><ul>';
                if (signal.tiers && signal.tiers.length > 0) {
                    signal.tiers.forEach(tier => {
                        tiersHTML += `<li>Duration: ${tier.duration}, Profit: ${tier.profit}, Min Amount: ${tier.minAmount}</li>`;
                    });
                } else {
                    tiersHTML += '<li>No tiers specified.</li>';
                }
                tiersHTML += '</ul>';
                tiersDiv.innerHTML = tiersHTML;

                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = `
                    <div><strong>Platform:</strong> ${signal.platform}</div>
                    <div><strong>Product:</strong> ${signal.product}</div>
                    <div><strong>Direction:</strong> ${signal.direction}</div>
                    ${signal.orderTimeLimit ? `<div><strong>Order Time Limit:</strong> ${signal.orderTimeLimit}</div>` : ''}
                    ${signal.tradeStyle ? `<div><strong>Trade Style:</strong> ${signal.tradeStyle}</div>` : ''}
                `;
                listItem.appendChild(contentDiv);
                listItem.appendChild(tiersDiv); // Append tiers div

                const addedDiv = document.createElement('div');
                addedDiv.innerHTML = `<div><strong>Added:</strong> ${new Date(signal.added).toLocaleString()}</div>`;
                listItem.appendChild(addedDiv);

                const rawTextDiv = document.createElement('div');
                rawTextDiv.textContent = signal.rawText;
                rawTextDiv.classList.add('raw-text-display');
                listItem.appendChild(rawTextDiv);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete Signal';
                deleteButton.dataset.id = signal.id;
                deleteButton.addEventListener('click', () => deleteTieredTradingSignal(signal.id));
                listItem.appendChild(deleteButton);
                tieredTradingSignalList.appendChild(listItem);
            });
        } else {
            tieredTradingSignalList.innerHTML = '<li>No tiered trading signals stored yet.</li>';
        }
    };

    request.onerror = (event) => {
        console.error('Error retrieving tiered trading signals:', event.target.error);
        tieredTradingSignalList.innerHTML = '<li>Error loading tiered trading signals.</li>';
    };
}

function deleteTieredTradingSignal(signalId) {
    if (!db) {
        console.error('Database not initialized for deleting tiered trading signal.');
        return;
    }
    const transaction = db.transaction([tieredTradingSignalsStoreName], 'readwrite');
    const store = transaction.objectStore(tieredTradingSignalsStoreName);
    const request = store.delete(signalId);

    request.onsuccess = () => {
        console.log('Tiered trading signal deleted successfully:', signalId);
        displayTieredTradingSignals();
    };
    request.onerror = (event) => {
        console.error('Error deleting tiered trading signal:', event.target.error);
    };
    }

    function displayPositionUpdates() {
        // console.log('displayPositionUpdates called');
    if (!db || !positionUpdateList) {
        console.error('Database or list element not ready for Position Updates.');
        if (positionUpdateList) positionUpdateList.innerHTML = '<li>Database not ready or list element missing.</li>';
        return;
    }
    positionUpdateList.innerHTML = '';

    const transaction = db.transaction([positionUpdatesStoreName], 'readonly');
    const store = transaction.objectStore(positionUpdatesStoreName);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const updates = event.target.result;
        if (updates && updates.length > 0) {
            updates.forEach(update => {
                const listItem = document.createElement('li');
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = `
                    ${update.platform ? `<div><strong>Platform:</strong> ${update.platform}</div>` : ''}
                    <div><strong>Asset:</strong> ${update.asset}</div>
                    <div><strong>Price:</strong> ${update.price}</div>
                    ${update.profit ? `<div><strong>Profit:</strong> ${update.profit}</div>` : ''}
                    <div><strong>Added:</strong> ${new Date(update.added).toLocaleString()}</div>
                `;
                listItem.appendChild(contentDiv);

                const rawTextDiv = document.createElement('div');
                rawTextDiv.textContent = update.rawText;
                rawTextDiv.classList.add('raw-text-display');
                listItem.appendChild(rawTextDiv);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete Update';
                deleteButton.dataset.id = update.id;
                deleteButton.addEventListener('click', () => deletePositionUpdate(update.id));
                listItem.appendChild(deleteButton);
                positionUpdateList.appendChild(listItem);
            });
        } else {
            positionUpdateList.innerHTML = '<li>No position updates stored yet.</li>';
        }
    };

    request.onerror = (event) => {
        console.error('Error retrieving position updates:', event.target.error);
        positionUpdateList.innerHTML = '<li>Error loading position updates.</li>';
    };
}

function deletePositionUpdate(updateId) {
    if (!db) {
        console.error('Database not initialized for deleting position update.');
        return;
    }
    const transaction = db.transaction([positionUpdatesStoreName], 'readwrite');
    const store = transaction.objectStore(positionUpdatesStoreName);
    const request = store.delete(updateId);

    request.onsuccess = () => {
        console.log('Position update deleted successfully:', updateId);
        displayPositionUpdates();
    };
    request.onerror = (event) => {
        console.error('Error deleting position update:', event.target.error);
    };
    }

    function displayPlatformInvites() {
        // console.log('displayPlatformInvites called');
    if (!db || !platformInviteList) {
        console.error('Database or list element not ready for Platform Invites.');
        if (platformInviteList) platformInviteList.innerHTML = '<li>Database not ready or list element missing.</li>';
        return;
    }
    platformInviteList.innerHTML = '';

    const transaction = db.transaction([platformInvitesStoreName], 'readonly');
    const store = transaction.objectStore(platformInvitesStoreName);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const invites = event.target.result;
        if (invites && invites.length > 0) {
            invites.forEach(invite => {
                const listItem = document.createElement('li');
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = `
                    <div><strong>Platform:</strong> ${invite.platform}</div>
                    ${invite.link ? `<div><strong>Link:</strong> <a href="${invite.link}" target="_blank">${invite.link}</a></div>` : ''}
                    ${invite.message ? `<div><strong>Message:</strong> <pre>${invite.message}</pre></div>` : ''}
                    <div><strong>Added:</strong> ${new Date(invite.added).toLocaleString()}</div>
                `;
                listItem.appendChild(contentDiv);

                const rawTextDiv = document.createElement('div');
                rawTextDiv.textContent = invite.rawText;
                rawTextDiv.classList.add('raw-text-display');
                listItem.appendChild(rawTextDiv);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete Invite';
                deleteButton.dataset.id = invite.id;
                deleteButton.addEventListener('click', () => deletePlatformInvite(invite.id));
                listItem.appendChild(deleteButton);
                platformInviteList.appendChild(listItem);
            });
        } else {
            platformInviteList.innerHTML = '<li>No platform invites stored yet.</li>';
        }
    };

    request.onerror = (event) => {
        console.error('Error retrieving platform invites:', event.target.error);
        platformInviteList.innerHTML = '<li>Error loading platform invites.</li>';
    };
    }

function deletePlatformInvite(inviteId) {
    if (!db) {
        console.error('Database not initialized for deleting platform invite.');
        return;
    }
    const transaction = db.transaction([platformInvitesStoreName], 'readwrite');
    const store = transaction.objectStore(platformInvitesStoreName);
    const request = store.delete(inviteId);

    request.onsuccess = () => {
        console.log('Platform invite deleted successfully:', inviteId);
        displayPlatformInvites();
    };
    request.onerror = (event) => {
        console.error('Error deleting platform invite:', event.target.error);
    };
}

// Event Listeners for new forms

if (detailedTradingSignalForm) {
    detailedTradingSignalForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const signal = {
            platform: detailedSignalPlatformInput.value.trim(),
            pair: detailedSignalPairInput.value.trim(),
            direction: detailedSignalDirectionInput.value.trim(),
            duration: detailedSignalDurationInput.value.trim(),
            tradeValue: detailedSignalTradeValueInput.value.trim(),
            timeLimit: detailedSignalTimeLimitInput.value.trim(),
            access: detailedSignalAccessInput.value.trim(),
            rawText: detailedSignalRawTextInput.value.trim(),
            added: new Date()
        };
        if (signal.platform && signal.pair && signal.direction && signal.rawText) {
            addDetailedTradingSignal(signal);
            detailedTradingSignalForm.reset();
        } else {
            alert('Please fill in all required fields for Detailed Trading Signal.');
        }
    });
}

function addDetailedTradingSignal(signal) {
    if (!db) { console.error('DB not ready'); return; }
    const transaction = db.transaction([detailedTradingSignalsStoreName], 'readwrite');
    const store = transaction.objectStore(detailedTradingSignalsStoreName);
    const request = store.add(signal);
    request.onsuccess = () => {
        console.log('Detailed Trading Signal added:', signal);
        displayDetailedTradingSignals();
    };
    request.onerror = (e) => console.error('Error adding Detailed Trading Signal:', e.target.error);
}


if (tieredTradingSignalForm) {
    tieredTradingSignalForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const tiersString = tieredSignalTiersInput.value.trim();
        let tiers = [];
        if (tiersString) {
            try {
                tiers = tiersString.split(';').map(tierStr => {
                    const parts = tierStr.split(',');
                    return {
                        duration: parts[0] ? parts[0].trim() : '',
                        profit: parts[1] ? parts[1].trim() : '',
                        minAmount: parts[2] ? parts[2].trim() : ''
                    };
                });
            } catch (e) {
                console.error("Error parsing tiers string:", e);
                alert("Error parsing tiers. Please check the format (duration,profit,min_amount;...).");
                return;
            }
        }

        const signal = {
            platform: tieredSignalPlatformInput.value.trim(),
            product: tieredSignalProductInput.value.trim(),
            direction: tieredSignalDirectionInput.value.trim(),
            orderTimeLimit: tieredSignalOrderTimeLimitInput.value.trim(),
            tradeStyle: tieredSignalTradeStyleInput.value.trim(),
            tiers: tiers,
            rawText: tieredSignalRawTextInput.value.trim(),
            added: new Date()
        };

        if (signal.platform && signal.product && signal.direction && signal.rawText) {
            addTieredTradingSignal(signal);
            tieredTradingSignalForm.reset();
        } else {
            alert('Please fill in all required fields for Tiered Trading Signal.');
        }
    });
}

function addTieredTradingSignal(signal) {
    if (!db) { console.error('DB not ready'); return; }
    const transaction = db.transaction([tieredTradingSignalsStoreName], 'readwrite');
    const store = transaction.objectStore(tieredTradingSignalsStoreName);
    const request = store.add(signal);
    request.onsuccess = () => {
        console.log('Tiered Trading Signal added:', signal);
        displayTieredTradingSignals();
    };
    request.onerror = (e) => console.error('Error adding Tiered Trading Signal:', e.target.error);
}


if (positionUpdateForm) {
    positionUpdateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const update = {
            platform: positionUpdatePlatformInput.value.trim(),
            asset: positionUpdateAssetInput.value.trim(),
            price: positionUpdatePriceInput.value.trim(),
            profit: positionUpdateProfitInput.value.trim(),
            rawText: positionUpdateRawTextInput.value.trim(),
            added: new Date()
        };
        if (update.asset && update.price && update.rawText) {
            addPositionUpdate(update);
            positionUpdateForm.reset();
        } else {
            alert('Please fill in Asset, Price, and Raw Text for Position Update.');
        }
    });
}

function addPositionUpdate(update) {
    if (!db) { console.error('DB not ready'); return; }
    const transaction = db.transaction([positionUpdatesStoreName], 'readwrite');
    const store = transaction.objectStore(positionUpdatesStoreName);
    const request = store.add(update);
    request.onsuccess = () => {
        console.log('Position Update added:', update);
        displayPositionUpdates();
    };
    request.onerror = (e) => console.error('Error adding Position Update:', e.target.error);
}


if (platformInviteForm) {
    platformInviteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const invite = {
            platform: platformInviteNameInput.value.trim(), // platformInviteNameInput is the ID in HTML for platform name
            link: platformInviteLinkInput.value.trim(),
            message: platformInviteMessageInput.value.trim(),
            rawText: platformInviteRawTextInput.value.trim(),
            added: new Date()
        };
        if (invite.platform && invite.rawText) {
            addPlatformInvite(invite);
            platformInviteForm.reset();
        } else {
            alert('Please fill in Platform Name and Raw Text for Platform Invite.');
        }
    });
}

function addPlatformInvite(invite) {
    if (!db) { console.error('DB not ready'); return; }
    const transaction = db.transaction([platformInvitesStoreName], 'readwrite');
    const store = transaction.objectStore(platformInvitesStoreName);
    const request = store.add(invite);
    request.onsuccess = () => {
        console.log('Platform Invite added:', invite);
        displayPlatformInvites();
    };
    request.onerror = (e) => console.error('Error adding Platform Invite:', e.target.error);
}

});
