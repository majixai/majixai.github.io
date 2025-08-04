import { UIManager } from './UIManager.js';
import { EntityManager } from './EntityManager.js';
import { CalendarManager } from './CalendarManager.js';
import { NotificationService } from './NotificationService.js';
import { ContactManager } from './ContactManager.js';
import { ContactUIManager } from './ContactUIManager.js';

class App {
    constructor() {
        this.uiManager = new UIManager();
        this.entityManager = new EntityManager(this.uiManager);
        this.calendarManager = new CalendarManager(document.getElementById('calendar'));
        this.contactUIManager = new ContactUIManager();
        this.contactManager = new ContactManager(this.contactUIManager);
    }

    async initialize() {
        this.uiManager.setupSectionToggle();
        this.setupEventListeners();
        await this.entityManager.loadEntities();
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

        document.getElementById('toggle-calendar-btn').addEventListener('click', () => {
            this.handleViewToggle('calendar');
        });

        document.getElementById('toggle-iframe-btn').addEventListener('click', () => {
            this.handleViewToggle('iframe');
        });

        document.getElementById('toggle-contacts-btn').addEventListener('click', () => {
            this.handleViewToggle('contacts');
        });

        document.getElementById('slot-machine-btn').addEventListener('click', () => {
            this.uiManager.openSlotMachineModal();
        });

        document.getElementById('download-btn').addEventListener('click', () => {
            this.handleDownload();
        });

        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('upload-input').click();
        });

        document.getElementById('upload-input').addEventListener('change', (event) => {
            this.handleUpload(event);
        });
    }

    async handleFormSubmit() {
        try {
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
                link,
                notes,
                attachments,
                tradesPerDay: section === 'investing' ? tradesPerDay : undefined,
            };

            await this.entityManager.addLinkToEntity(name, section, linkData);
            this.uiManager.resetForm();
        } catch (error) {
            NotificationService.showError('An error occurred.');
            console.error(error);
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

    handleViewToggle(view) {
        this.uiManager.switchView(view);
    }

    handleDownload() {
        const data = {
            entities: this.entityManager.getAllEntities(),
            contacts: this.contactManager.getAllContacts(),
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "link_manager_data.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    handleUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.entities) {
                        this.entityManager.loadFromData(data.entities);
                    }
                    if (data.contacts) {
                        this.contactManager.loadFromData(data.contacts);
                    }
                    NotificationService.showSuccess('Data loaded successfully!');
                } catch (error) {
                    NotificationService.showError('Error parsing file.');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});
