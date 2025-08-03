import { UIManager } from './UIManager.js';
import { LinkManager } from './LinkManager.js';
import { CalendarManager } from './CalendarManager.js';
import { NotificationService } from './NotificationService.js';
import { ContactManager } from './ContactManager.js';
import { ContactUIManager } from './ContactUIManager.js';

class App {
    constructor() {
        this.uiManager = new UIManager();
        this.linkManager = new LinkManager(this.uiManager);
        this.calendarManager = new CalendarManager(document.getElementById('calendar'));
        this.contactUIManager = new ContactUIManager();
        this.contactManager = new ContactManager(this.contactUIManager);
    }

    async initialize() {
        this.uiManager.setupSectionToggle();
        this.setupEventListeners();
        await this.linkManager.loadLinks();
        await this.contactManager.loadContacts();
        await this.calendarManager.initialize();
    }

    setupEventListeners() {
        this.uiManager.linkForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleFormSubmit();
        });

        this.contactUIManager.contactForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleContactFormSubmit();
        });

        this.contactUIManager.connectionForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleConnectionFormSubmit();
        });

        const linkContainers = [
            this.uiManager.chatLinksContainer,
            this.uiManager.investingLinksContainer,
            this.uiManager.onlineLinksContainer
        ];

        linkContainers.forEach(container => {
            container.addEventListener('click', (event) => {
                if (event.target.classList.contains('actions-btn')) {
                    const linkItem = event.target.closest('.link-item');
                    const linkId = Number(linkItem.getAttribute('data-id'));
                    this.uiManager.openModal(linkId);
                } else if (event.target.classList.contains('ledger-btn')) {
                    const linkItem = event.target.closest('.link-item');
                    const linkId = Number(linkItem.getAttribute('data-id'));
                    this.handleViewLedgerClick(linkId);
                } else if (event.target.tagName === 'A') {
                    event.preventDefault();
                    const linkItem = event.target.closest('.link-item');
                    const linkId = Number(linkItem.getAttribute('data-id'));
                    this.handleLinkClick(linkId);
                }
            });

            container.addEventListener('change', (event) => {
                this.handleToggleClick(event);
            });
        });

        this.uiManager.modal.addEventListener('click', (event) => {
            this.handleModalClick(event);
        });

        this.uiManager.ledgerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleLedgerFormSubmit();
        });

        this.uiManager.addAttachmentBtn.addEventListener('click', () => {
            const type = this.uiManager.attachmentTypeInput.value;
            const value = this.uiManager.attachmentValueInput.value;
            if (value) {
                this.uiManager.attachments.push({ type, value });
                this.uiManager.renderAttachments();
                this.uiManager.attachmentValueInput.value = '';
            }
        });

        this.contactUIManager.addAttachmentBtn.addEventListener('click', () => {
            const type = this.contactUIManager.attachmentTypeInput.value;
            const value = this.contactUIManager.attachmentValueInput.value;
            if (value) {
                this.contactUIManager.attachments.push({ type, value });
                this.contactUIManager.renderAttachments();
                this.contactUIManager.attachmentValueInput.value = '';
            }
        });

        document.getElementById('show-entire-ledger-btn').addEventListener('click', () => {
            this.handleShowEntireLedger();
        });
    }

    async handleFormSubmit() {
        try {
            const editingId = this.uiManager.editingIdInput.value;
            const name = document.getElementById('name').value;
            const link = document.getElementById('link').value;
            const section = this.uiManager.sectionSelect.value;
            const tradesPerDay = this.uiManager.tradesPerDayInput.value;
            const notes = this.uiManager.notesInput.value;
            const attachments = this.uiManager.attachments;

            if (!name || !link) {
                NotificationService.showError('Name and link are required.');
                return;
            }

            const linkData = {
                id: editingId ? Number(editingId) : null,
                name,
                link,
                section,
                tradesPerDay,
                notes,
                attachments
            };

            if (editingId) {
                await this.linkManager.updateLink(linkData);
            } else {
                await this.linkManager.addLink(linkData);
            }

            this.uiManager.resetForm();
        } catch (error) {
            NotificationService.showError('An error occurred.');
            console.error(error);
        }
    }

    handleLinkClick(linkId) {
        const link = this.linkManager.getLinkById(linkId);
        if (link) {
            switch (link.section) {
                case 'chat':
                case 'online':
                case 'investing':
                    this.uiManager.loadUrlInIframe(link.link);
                    break;
                default:
                    NotificationService.showError('Unknown section.');
            }
        }
    }

    handleViewLedgerClick(linkId) {
        const link = this.linkManager.getLinkById(linkId);
        if (link) {
            this.uiManager.showLedger(link);
        }
    }

    async handleLedgerFormSubmit() {
        const linkId = this.uiManager.currentLedgerLinkId;
        if (!linkId) return;

        const date = document.getElementById('ledger-date').value;
        const description = document.getElementById('ledger-description').value;
        const amount = document.getElementById('ledger-amount').value;

        if (!date || !description || !amount) {
            NotificationService.showError('All ledger fields are required.');
            return;
        }

        const entry = { date, description, amount: parseFloat(amount) };
        await this.linkManager.addLedgerEntry(linkId, entry);
        this.uiManager.ledgerForm.reset();
    }

    handleModalClick(event) {
        const linkId = this.uiManager.currentLinkId;
        if (!linkId) return;

        if (event.target.id === 'modal-edit-btn') {
            const link = this.linkManager.getLinkById(linkId);
            if (link) {
                this.uiManager.populateFormForEdit(link);
                this.uiManager.closeModal();
            }
        } else if (event.target.id === 'modal-delete-btn') {
            this.linkManager.deleteLink(linkId);
            this.uiManager.closeModal();
        }
    }

    async handleToggleClick(event) {
        const linkItem = event.target.closest('.link-item');
        if (!linkItem) return;

        const linkId = Number(linkItem.getAttribute('data-id'));

        if (event.target.classList.contains('toggle-switch')) {
            await this.linkManager.toggleLink(linkId);
            NotificationService.showInfo('Link toggled.');
        } else if (event.target.classList.contains('complete-toggle')) {
            await this.linkManager.toggleLinkProperty(linkId, 'complete');
            NotificationService.showInfo('Complete status toggled.');
        } else if (event.target.classList.contains('ip-toggle')) {
            await this.linkManager.toggleLinkProperty(linkId, 'ip');
            NotificationService.showInfo('IP status toggled.');
        }
    }

    async handleContactFormSubmit() {
        const nameInput = document.getElementById('contact-name');
        const name = nameInput.value;
        const attachments = this.contactUIManager.attachments;
        if (name) {
            await this.contactManager.addContact({ name, attachments });
            nameInput.value = '';
            this.contactUIManager.attachments = [];
            this.contactUIManager.renderAttachments();
            NotificationService.showSuccess('Contact added successfully!');
        } else {
            NotificationService.showError('Contact name is required.');
        }
    }

    async handleConnectionFormSubmit() {
        const contact1Id = this.contactUIManager.contactSelect1.value;
        const contact2Id = this.contactUIManager.contactSelect2.value;
        if (contact1Id && contact2Id && contact1Id !== contact2Id) {
            await this.contactManager.addConnection(Number(contact1Id), Number(contact2Id));
            await this.contactManager.addConnection(Number(contact2Id), Number(contact1Id));
            NotificationService.showSuccess('Connection added successfully!');
        } else {
            NotificationService.showError('Please select two different contacts.');
        }
    }

    handleShowEntireLedger() {
        const allLinks = this.linkManager.getAllLinks();
        this.uiManager.renderEntireLedger(allLinks);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});
