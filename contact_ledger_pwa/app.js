/**
 * Contact & Ledger Manager PWA
 * Manages contacts, company ledgers, and check-ins for quizzes, homework, and testing
 */

(function() {
    'use strict';

    // ============================================
    // DATABASE MANAGER (IndexedDB)
    // ============================================
    class DatabaseManager {
        static #DB_NAME = 'ContactLedgerDB';
        static #VERSION = 1;
        #db = null;

        static STORES = {
            CONTACTS: 'contacts',
            COMPANIES: 'companies',
            CHECKINS: 'checkins',
            LEDGER: 'ledger'
        };

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DatabaseManager.#DB_NAME, DatabaseManager.#VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    // Create Contacts store
                    if (!db.objectStoreNames.contains(DatabaseManager.STORES.CONTACTS)) {
                        const contactStore = db.createObjectStore(DatabaseManager.STORES.CONTACTS, { keyPath: 'id', autoIncrement: true });
                        contactStore.createIndex('companyId', 'companyId', { unique: false });
                        contactStore.createIndex('name', 'name', { unique: false });
                    }

                    // Create Companies store
                    if (!db.objectStoreNames.contains(DatabaseManager.STORES.COMPANIES)) {
                        const companyStore = db.createObjectStore(DatabaseManager.STORES.COMPANIES, { keyPath: 'id', autoIncrement: true });
                        companyStore.createIndex('name', 'name', { unique: false });
                    }

                    // Create Check-ins store
                    if (!db.objectStoreNames.contains(DatabaseManager.STORES.CHECKINS)) {
                        const checkinStore = db.createObjectStore(DatabaseManager.STORES.CHECKINS, { keyPath: 'id', autoIncrement: true });
                        checkinStore.createIndex('contactId', 'contactId', { unique: false });
                        checkinStore.createIndex('type', 'type', { unique: false });
                        checkinStore.createIndex('date', 'date', { unique: false });
                    }

                    // Create Ledger store
                    if (!db.objectStoreNames.contains(DatabaseManager.STORES.LEDGER)) {
                        const ledgerStore = db.createObjectStore(DatabaseManager.STORES.LEDGER, { keyPath: 'id', autoIncrement: true });
                        ledgerStore.createIndex('companyId', 'companyId', { unique: false });
                        ledgerStore.createIndex('type', 'type', { unique: false });
                        ledgerStore.createIndex('date', 'date', { unique: false });
                        ledgerStore.createIndex('category', 'category', { unique: false });
                    }
                };

                request.onsuccess = (event) => {
                    this.#db = event.target.result;
                    console.log('Database initialized successfully');
                    resolve();
                };

                request.onerror = (event) => {
                    console.error('Database error:', event.target.error);
                    reject(event.target.error);
                };
            });
        }

        async getAll(storeName) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async getById(storeName, id) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async add(storeName, data) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                data.createdAt = new Date().toISOString();
                data.updatedAt = new Date().toISOString();
                const request = store.add(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async update(storeName, data) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                data.updatedAt = new Date().toISOString();
                const request = store.put(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async delete(storeName, id) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async getByIndex(storeName, indexName, value) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(value);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ============================================
    // APPLICATION STATE
    // ============================================
    const state = {
        contacts: [],
        companies: [],
        checkins: [],
        ledger: [],
        currentTab: 'contacts',
        deleteCallback: null
    };

    const db = new DatabaseManager();

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const elements = {
        // Tab navigation
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),

        // Install button
        installBtn: document.getElementById('installBtn'),

        // Contacts
        addContactBtn: document.getElementById('addContactBtn'),
        contactSearch: document.getElementById('contactSearch'),
        companyFilter: document.getElementById('companyFilter'),
        contactsList: document.getElementById('contactsList'),
        contactModal: document.getElementById('contactModal'),
        contactForm: document.getElementById('contactForm'),
        contactModalTitle: document.getElementById('contactModalTitle'),
        contactId: document.getElementById('contactId'),
        contactName: document.getElementById('contactName'),
        contactEmail: document.getElementById('contactEmail'),
        contactPhone: document.getElementById('contactPhone'),
        contactCompany: document.getElementById('contactCompany'),
        contactNotes: document.getElementById('contactNotes'),

        // Companies
        addCompanyBtn: document.getElementById('addCompanyBtn'),
        companySearch: document.getElementById('companySearch'),
        companiesList: document.getElementById('companiesList'),
        companyModal: document.getElementById('companyModal'),
        companyForm: document.getElementById('companyForm'),
        companyModalTitle: document.getElementById('companyModalTitle'),
        companyId: document.getElementById('companyId'),
        companyName: document.getElementById('companyName'),
        companyAddress: document.getElementById('companyAddress'),
        companyIndustry: document.getElementById('companyIndustry'),
        companyNotes: document.getElementById('companyNotes'),

        // Check-ins
        addCheckinBtn: document.getElementById('addCheckinBtn'),
        checkinTypeFilter: document.getElementById('checkinTypeFilter'),
        checkinContactFilter: document.getElementById('checkinContactFilter'),
        checkinsList: document.getElementById('checkinsList'),
        checkinModal: document.getElementById('checkinModal'),
        checkinForm: document.getElementById('checkinForm'),
        checkinModalTitle: document.getElementById('checkinModalTitle'),
        checkinId: document.getElementById('checkinId'),
        checkinContact: document.getElementById('checkinContact'),
        checkinType: document.getElementById('checkinType'),
        checkinDate: document.getElementById('checkinDate'),
        checkinScore: document.getElementById('checkinScore'),
        checkinStatus: document.getElementById('checkinStatus'),
        checkinNotes: document.getElementById('checkinNotes'),

        // Ledger
        addLedgerEntryBtn: document.getElementById('addLedgerEntryBtn'),
        ledgerTypeFilter: document.getElementById('ledgerTypeFilter'),
        ledgerCompanyFilter: document.getElementById('ledgerCompanyFilter'),
        ledgerSummary: document.getElementById('ledgerSummary'),
        ledgerList: document.getElementById('ledgerList'),
        ledgerModal: document.getElementById('ledgerModal'),
        ledgerForm: document.getElementById('ledgerForm'),
        ledgerModalTitle: document.getElementById('ledgerModalTitle'),
        ledgerId: document.getElementById('ledgerId'),
        ledgerType: document.getElementById('ledgerType'),
        ledgerCompanyGroup: document.getElementById('ledgerCompanyGroup'),
        ledgerCompany: document.getElementById('ledgerCompany'),
        ledgerDate: document.getElementById('ledgerDate'),
        ledgerDescription: document.getElementById('ledgerDescription'),
        ledgerCategory: document.getElementById('ledgerCategory'),
        ledgerAmount: document.getElementById('ledgerAmount'),
        ledgerNotes: document.getElementById('ledgerNotes'),

        // Confirmation
        confirmModal: document.getElementById('confirmModal'),
        confirmMessage: document.getElementById('confirmMessage'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
    };

    // ============================================
    // PWA INSTALL HANDLING
    // ============================================
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        elements.installBtn.style.display = 'block';
    });

    elements.installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Install prompt outcome: ${outcome}`);
        deferredPrompt = null;
        elements.installBtn.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        console.log('App installed successfully');
        elements.installBtn.style.display = 'none';
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }

    // ============================================
    // TAB NAVIGATION
    // ============================================
    function switchTab(tabName) {
        state.currentTab = tabName;

        elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        // Refresh the active tab's content
        refreshCurrentTab();
    }

    function refreshCurrentTab() {
        switch (state.currentTab) {
            case 'contacts':
                renderContacts();
                break;
            case 'companies':
                renderCompanies();
                break;
            case 'checkins':
                renderCheckins();
                break;
            case 'ledger':
                renderLedger();
                break;
        }
    }

    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // ============================================
    // MODAL HANDLING
    // ============================================
    function openModal(modal) {
        modal.classList.add('active');
    }

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    // Close modal buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.close;
            closeModal(document.getElementById(modalId));
        });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getCompanyName(companyId) {
        if (!companyId) return 'No Company';
        const company = state.companies.find(c => c.id === companyId);
        return company ? company.name : 'Unknown Company';
    }

    function getContactName(contactId) {
        if (!contactId) return 'Unknown Contact';
        const contact = state.contacts.find(c => c.id === contactId);
        return contact ? contact.name : 'Unknown Contact';
    }

    // ============================================
    // POPULATE DROPDOWNS
    // ============================================
    function populateCompanyDropdowns() {
        const companyOptions = state.companies.map(c => 
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('');

        // Contact form company select
        elements.contactCompany.innerHTML = `<option value="">No Company</option>${companyOptions}`;

        // Ledger form company select
        elements.ledgerCompany.innerHTML = `<option value="">Select Company</option>${companyOptions}`;

        // Filters
        elements.companyFilter.innerHTML = `<option value="">All Companies</option>${companyOptions}`;
        elements.ledgerCompanyFilter.innerHTML = `<option value="">All Companies</option>${companyOptions}`;
    }

    function populateContactDropdowns() {
        const contactOptions = state.contacts.map(c => 
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('');

        elements.checkinContact.innerHTML = `<option value="">Select Contact</option>${contactOptions}`;
        elements.checkinContactFilter.innerHTML = `<option value="">All Contacts</option>${contactOptions}`;
    }

    // ============================================
    // CONTACTS MANAGEMENT
    // ============================================
    function renderContacts() {
        const searchTerm = elements.contactSearch.value.toLowerCase();
        const companyId = elements.companyFilter.value;

        let filteredContacts = state.contacts.filter(contact => {
            const matchesSearch = contact.name.toLowerCase().includes(searchTerm) ||
                (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
                (contact.phone && contact.phone.includes(searchTerm));
            const matchesCompany = !companyId || contact.companyId === parseInt(companyId);
            return matchesSearch && matchesCompany;
        });

        if (filteredContacts.length === 0) {
            elements.contactsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👤</div>
                    <div class="empty-state-text">No contacts found</div>
                    <button class="btn-primary" data-action="add-first">Add your first contact</button>
                </div>
            `;
            return;
        }

        elements.contactsList.innerHTML = filteredContacts.map(contact => `
            <div class="card-item" data-id="${contact.id}">
                <div class="card-item-header">
                    <div>
                        <div class="card-item-title">${escapeHtml(contact.name)}</div>
                        <div class="card-item-subtitle">${escapeHtml(getCompanyName(contact.companyId))}</div>
                    </div>
                </div>
                <div class="card-item-details">
                    ${contact.email ? `<p>📧 ${escapeHtml(contact.email)}</p>` : ''}
                    ${contact.phone ? `<p>📞 ${escapeHtml(contact.phone)}</p>` : ''}
                    ${contact.notes ? `<p>📝 ${escapeHtml(contact.notes)}</p>` : ''}
                </div>
                <div class="card-item-actions">
                    <button class="btn-primary btn-small" data-action="edit" data-id="${contact.id}">Edit</button>
                    <button class="btn-danger btn-small" data-action="delete" data-id="${contact.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    elements.addContactBtn.addEventListener('click', () => {
        elements.contactModalTitle.textContent = 'Add Contact';
        elements.contactForm.reset();
        elements.contactId.value = '';
        populateCompanyDropdowns();
        openModal(elements.contactModal);
    });

    async function editContact(id) {
        const contact = await db.getById(DatabaseManager.STORES.CONTACTS, id);
        if (!contact) return;

        elements.contactModalTitle.textContent = 'Edit Contact';
        elements.contactId.value = contact.id;
        elements.contactName.value = contact.name;
        elements.contactEmail.value = contact.email || '';
        elements.contactPhone.value = contact.phone || '';
        populateCompanyDropdowns();
        elements.contactCompany.value = contact.companyId || '';
        elements.contactNotes.value = contact.notes || '';
        openModal(elements.contactModal);
    }

    function deleteContact(id) {
        const contact = state.contacts.find(c => c.id === id);
        elements.confirmMessage.textContent = `Are you sure you want to delete "${contact?.name}"?`;
        state.deleteCallback = async () => {
            await db.delete(DatabaseManager.STORES.CONTACTS, id);
            await loadData();
            refreshCurrentTab();
        };
        openModal(elements.confirmModal);
    }

    // Event delegation for contacts list
    elements.contactsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
        
        if (action === 'add-first') {
            elements.addContactBtn.click();
        } else if (action === 'edit' && id) {
            editContact(id);
        } else if (action === 'delete' && id) {
            deleteContact(id);
        }
    });

    elements.contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const contactData = {
            name: elements.contactName.value.trim(),
            email: elements.contactEmail.value.trim(),
            phone: elements.contactPhone.value.trim(),
            companyId: elements.contactCompany.value ? parseInt(elements.contactCompany.value) : null,
            notes: elements.contactNotes.value.trim()
        };

        const id = elements.contactId.value;
        if (id) {
            contactData.id = parseInt(id);
            await db.update(DatabaseManager.STORES.CONTACTS, contactData);
        } else {
            await db.add(DatabaseManager.STORES.CONTACTS, contactData);
        }

        closeModal(elements.contactModal);
        await loadData();
        refreshCurrentTab();
    });

    elements.contactSearch.addEventListener('input', renderContacts);
    elements.companyFilter.addEventListener('change', renderContacts);

    // ============================================
    // COMPANIES MANAGEMENT
    // ============================================
    function renderCompanies() {
        const searchTerm = elements.companySearch.value.toLowerCase();

        let filteredCompanies = state.companies.filter(company => 
            company.name.toLowerCase().includes(searchTerm) ||
            (company.industry && company.industry.toLowerCase().includes(searchTerm))
        );

        if (filteredCompanies.length === 0) {
            elements.companiesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏢</div>
                    <div class="empty-state-text">No companies found</div>
                    <button class="btn-primary" data-action="add-first">Add your first company</button>
                </div>
            `;
            return;
        }

        elements.companiesList.innerHTML = filteredCompanies.map(company => {
            const contactCount = state.contacts.filter(c => c.companyId === company.id).length;
            return `
                <div class="card-item" data-id="${company.id}">
                    <div class="card-item-header">
                        <div>
                            <div class="card-item-title">${escapeHtml(company.name)}</div>
                            ${company.industry ? `<div class="card-item-subtitle">${escapeHtml(company.industry)}</div>` : ''}
                        </div>
                        <span class="badge badge-other">${contactCount} contact${contactCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="card-item-details">
                        ${company.address ? `<p>📍 ${escapeHtml(company.address)}</p>` : ''}
                        ${company.notes ? `<p>📝 ${escapeHtml(company.notes)}</p>` : ''}
                    </div>
                    <div class="card-item-actions">
                        <button class="btn-primary btn-small" data-action="edit" data-id="${company.id}">Edit</button>
                        <button class="btn-danger btn-small" data-action="delete" data-id="${company.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    elements.addCompanyBtn.addEventListener('click', () => {
        elements.companyModalTitle.textContent = 'Add Company';
        elements.companyForm.reset();
        elements.companyId.value = '';
        openModal(elements.companyModal);
    });

    async function editCompany(id) {
        const company = await db.getById(DatabaseManager.STORES.COMPANIES, id);
        if (!company) return;

        elements.companyModalTitle.textContent = 'Edit Company';
        elements.companyId.value = company.id;
        elements.companyName.value = company.name;
        elements.companyAddress.value = company.address || '';
        elements.companyIndustry.value = company.industry || '';
        elements.companyNotes.value = company.notes || '';
        openModal(elements.companyModal);
    }

    function deleteCompany(id) {
        const company = state.companies.find(c => c.id === id);
        elements.confirmMessage.textContent = `Are you sure you want to delete "${company?.name}"? This will not delete associated contacts.`;
        state.deleteCallback = async () => {
            await db.delete(DatabaseManager.STORES.COMPANIES, id);
            await loadData();
            refreshCurrentTab();
        };
        openModal(elements.confirmModal);
    }

    // Event delegation for companies list
    elements.companiesList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
        
        if (action === 'add-first') {
            elements.addCompanyBtn.click();
        } else if (action === 'edit' && id) {
            editCompany(id);
        } else if (action === 'delete' && id) {
            deleteCompany(id);
        }
    });

    elements.companyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const companyData = {
            name: elements.companyName.value.trim(),
            address: elements.companyAddress.value.trim(),
            industry: elements.companyIndustry.value.trim(),
            notes: elements.companyNotes.value.trim()
        };

        const id = elements.companyId.value;
        if (id) {
            companyData.id = parseInt(id);
            await db.update(DatabaseManager.STORES.COMPANIES, companyData);
        } else {
            await db.add(DatabaseManager.STORES.COMPANIES, companyData);
        }

        closeModal(elements.companyModal);
        await loadData();
        refreshCurrentTab();
    });

    elements.companySearch.addEventListener('input', renderCompanies);

    // ============================================
    // CHECK-INS MANAGEMENT
    // ============================================
    function renderCheckins() {
        const typeFilter = elements.checkinTypeFilter.value;
        const contactFilter = elements.checkinContactFilter.value;

        let filteredCheckins = state.checkins.filter(checkin => {
            const matchesType = !typeFilter || checkin.type === typeFilter;
            const matchesContact = !contactFilter || checkin.contactId === parseInt(contactFilter);
            return matchesType && matchesContact;
        });

        // Sort by date descending
        filteredCheckins.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredCheckins.length === 0) {
            elements.checkinsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-text">No check-ins found</div>
                    <button class="btn-primary" data-action="add-first">Add a check-in</button>
                </div>
            `;
            return;
        }

        elements.checkinsList.innerHTML = filteredCheckins.map(checkin => `
            <div class="card-item" data-id="${checkin.id}">
                <div class="card-item-header">
                    <div>
                        <div class="card-item-title">${escapeHtml(getContactName(checkin.contactId))}</div>
                        <div class="card-item-subtitle">${formatDateTime(checkin.date)}</div>
                    </div>
                    <div>
                        <span class="badge badge-${checkin.type}">${checkin.type}</span>
                        <span class="badge badge-${checkin.status}">${checkin.status}</span>
                    </div>
                </div>
                <div class="card-item-details">
                    ${checkin.score ? `<p>📊 Score: ${escapeHtml(checkin.score)}</p>` : ''}
                    ${checkin.notes ? `<p>📝 ${escapeHtml(checkin.notes)}</p>` : ''}
                </div>
                <div class="card-item-actions">
                    <button class="btn-primary btn-small" data-action="edit" data-id="${checkin.id}">Edit</button>
                    <button class="btn-danger btn-small" data-action="delete" data-id="${checkin.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    elements.addCheckinBtn.addEventListener('click', () => {
        elements.checkinModalTitle.textContent = 'New Check-in';
        elements.checkinForm.reset();
        elements.checkinId.value = '';
        populateContactDropdowns();
        // Set default date to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        elements.checkinDate.value = now.toISOString().slice(0, 16);
        openModal(elements.checkinModal);
    });

    async function editCheckin(id) {
        const checkin = await db.getById(DatabaseManager.STORES.CHECKINS, id);
        if (!checkin) return;

        elements.checkinModalTitle.textContent = 'Edit Check-in';
        elements.checkinId.value = checkin.id;
        populateContactDropdowns();
        elements.checkinContact.value = checkin.contactId;
        elements.checkinType.value = checkin.type;
        elements.checkinDate.value = checkin.date.slice(0, 16);
        elements.checkinScore.value = checkin.score || '';
        elements.checkinStatus.value = checkin.status;
        elements.checkinNotes.value = checkin.notes || '';
        openModal(elements.checkinModal);
    }

    function deleteCheckin(id) {
        elements.confirmMessage.textContent = 'Are you sure you want to delete this check-in?';
        state.deleteCallback = async () => {
            await db.delete(DatabaseManager.STORES.CHECKINS, id);
            await loadData();
            refreshCurrentTab();
        };
        openModal(elements.confirmModal);
    }

    // Event delegation for check-ins list
    elements.checkinsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
        
        if (action === 'add-first') {
            elements.addCheckinBtn.click();
        } else if (action === 'edit' && id) {
            editCheckin(id);
        } else if (action === 'delete' && id) {
            deleteCheckin(id);
        }
    });

    elements.checkinForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const checkinData = {
            contactId: parseInt(elements.checkinContact.value),
            type: elements.checkinType.value,
            date: elements.checkinDate.value,
            score: elements.checkinScore.value.trim(),
            status: elements.checkinStatus.value,
            notes: elements.checkinNotes.value.trim()
        };

        const id = elements.checkinId.value;
        if (id) {
            checkinData.id = parseInt(id);
            await db.update(DatabaseManager.STORES.CHECKINS, checkinData);
        } else {
            await db.add(DatabaseManager.STORES.CHECKINS, checkinData);
        }

        closeModal(elements.checkinModal);
        await loadData();
        refreshCurrentTab();
    });

    elements.checkinTypeFilter.addEventListener('change', renderCheckins);
    elements.checkinContactFilter.addEventListener('change', renderCheckins);

    // ============================================
    // LEDGER MANAGEMENT
    // ============================================
    function renderLedger() {
        const typeFilter = elements.ledgerTypeFilter.value;
        const companyFilter = elements.ledgerCompanyFilter.value;

        let filteredLedger = state.ledger.filter(entry => {
            const matchesType = !typeFilter || entry.type === typeFilter;
            const matchesCompany = !companyFilter || entry.companyId === parseInt(companyFilter);
            return matchesType && matchesCompany;
        });

        // Sort by date descending
        filteredLedger.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate summary
        const summary = filteredLedger.reduce((acc, entry) => {
            if (entry.category === 'income') {
                acc.income += entry.amount;
            } else if (entry.category === 'expense') {
                acc.expense += entry.amount;
            }
            return acc;
        }, { income: 0, expense: 0 });

        summary.balance = summary.income - summary.expense;

        elements.ledgerSummary.innerHTML = `
            <div class="summary-item">
                <div class="summary-label">Total Income</div>
                <div class="summary-value income">${formatCurrency(summary.income)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Total Expenses</div>
                <div class="summary-value expense">${formatCurrency(summary.expense)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Balance</div>
                <div class="summary-value balance">${formatCurrency(summary.balance)}</div>
            </div>
        `;

        if (filteredLedger.length === 0) {
            elements.ledgerList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📒</div>
                    <div class="empty-state-text">No ledger entries found</div>
                    <button class="btn-primary" data-action="add-first">Add an entry</button>
                </div>
            `;
            return;
        }

        elements.ledgerList.innerHTML = filteredLedger.map(entry => `
            <div class="card-item" data-id="${entry.id}" style="border-left-color: ${entry.category === 'income' ? 'var(--success-color)' : entry.category === 'expense' ? 'var(--danger-color)' : 'var(--primary-color)'}">
                <div class="card-item-header">
                    <div>
                        <div class="card-item-title">${escapeHtml(entry.description)}</div>
                        <div class="card-item-subtitle">${formatDate(entry.date)} • ${entry.type === 'company' ? escapeHtml(getCompanyName(entry.companyId)) : 'General Ledger'}</div>
                    </div>
                    <div class="ledger-amount ${entry.category}">
                        ${entry.category === 'expense' ? '-' : '+'}${formatCurrency(Math.abs(entry.amount))}
                    </div>
                </div>
                <div class="card-item-details">
                    <p>Category: ${entry.category}</p>
                    ${entry.notes ? `<p>📝 ${escapeHtml(entry.notes)}</p>` : ''}
                </div>
                <div class="card-item-actions">
                    <button class="btn-primary btn-small" data-action="edit" data-id="${entry.id}">Edit</button>
                    <button class="btn-danger btn-small" data-action="delete" data-id="${entry.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Toggle company dropdown visibility based on ledger type
    elements.ledgerType.addEventListener('change', () => {
        const isCompanyLedger = elements.ledgerType.value === 'company';
        elements.ledgerCompanyGroup.style.display = isCompanyLedger ? 'block' : 'none';
        elements.ledgerCompany.required = isCompanyLedger;
    });

    elements.addLedgerEntryBtn.addEventListener('click', () => {
        elements.ledgerModalTitle.textContent = 'Add Ledger Entry';
        elements.ledgerForm.reset();
        elements.ledgerId.value = '';
        populateCompanyDropdowns();
        // Set default date to today
        elements.ledgerDate.value = new Date().toISOString().slice(0, 10);
        elements.ledgerType.dispatchEvent(new Event('change'));
        openModal(elements.ledgerModal);
    });

    async function editLedgerEntry(id) {
        const entry = await db.getById(DatabaseManager.STORES.LEDGER, id);
        if (!entry) return;

        elements.ledgerModalTitle.textContent = 'Edit Ledger Entry';
        elements.ledgerId.value = entry.id;
        elements.ledgerType.value = entry.type;
        populateCompanyDropdowns();
        elements.ledgerCompany.value = entry.companyId || '';
        elements.ledgerDate.value = entry.date;
        elements.ledgerDescription.value = entry.description;
        elements.ledgerCategory.value = entry.category;
        elements.ledgerAmount.value = entry.amount;
        elements.ledgerNotes.value = entry.notes || '';
        elements.ledgerType.dispatchEvent(new Event('change'));
        openModal(elements.ledgerModal);
    }

    function deleteLedgerEntry(id) {
        elements.confirmMessage.textContent = 'Are you sure you want to delete this ledger entry?';
        state.deleteCallback = async () => {
            await db.delete(DatabaseManager.STORES.LEDGER, id);
            await loadData();
            refreshCurrentTab();
        };
        openModal(elements.confirmModal);
    }

    // Event delegation for ledger list
    elements.ledgerList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
        
        if (action === 'add-first') {
            elements.addLedgerEntryBtn.click();
        } else if (action === 'edit' && id) {
            editLedgerEntry(id);
        } else if (action === 'delete' && id) {
            deleteLedgerEntry(id);
        }
    });

    elements.ledgerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const ledgerData = {
            type: elements.ledgerType.value,
            companyId: elements.ledgerType.value === 'company' && elements.ledgerCompany.value ? 
                parseInt(elements.ledgerCompany.value) : null,
            date: elements.ledgerDate.value,
            description: elements.ledgerDescription.value.trim(),
            category: elements.ledgerCategory.value,
            amount: parseFloat(elements.ledgerAmount.value),
            notes: elements.ledgerNotes.value.trim()
        };

        const id = elements.ledgerId.value;
        if (id) {
            ledgerData.id = parseInt(id);
            await db.update(DatabaseManager.STORES.LEDGER, ledgerData);
        } else {
            await db.add(DatabaseManager.STORES.LEDGER, ledgerData);
        }

        closeModal(elements.ledgerModal);
        await loadData();
        refreshCurrentTab();
    });

    elements.ledgerTypeFilter.addEventListener('change', renderLedger);
    elements.ledgerCompanyFilter.addEventListener('change', renderLedger);

    // ============================================
    // CONFIRMATION MODAL
    // ============================================
    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if (state.deleteCallback) {
            await state.deleteCallback();
            state.deleteCallback = null;
        }
        closeModal(elements.confirmModal);
    });

    // ============================================
    // DATA LOADING
    // ============================================
    async function loadData() {
        try {
            state.companies = await db.getAll(DatabaseManager.STORES.COMPANIES);
            state.contacts = await db.getAll(DatabaseManager.STORES.CONTACTS);
            state.checkins = await db.getAll(DatabaseManager.STORES.CHECKINS);
            state.ledger = await db.getAll(DatabaseManager.STORES.LEDGER);

            // Populate dropdowns
            populateCompanyDropdowns();
            populateContactDropdowns();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async function init() {
        try {
            await db.init();
            await loadData();
            refreshCurrentTab();
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

})();
