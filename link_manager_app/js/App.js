import { UIManager } from './UIManager.js';
import { LinkManager } from './LinkManager.js';
import { CalendarManager } from './CalendarManager.js';
import { NotificationService } from './NotificationService.js';

class App {
    constructor() {
        this.uiManager = new UIManager();
        this.linkManager = new LinkManager(this.uiManager);
        this.calendarManager = new CalendarManager(document.getElementById('calendar'));
    }

    async initialize() {
        this.uiManager.setupSectionToggle();
        this.setupEventListeners();
        await this.linkManager.loadLinks();
        await this.calendarManager.initialize();
    }

    setupEventListeners() {
        this.uiManager.linkForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleFormSubmit();
        });

        const linkContainers = [
            this.uiManager.chatLinksContainer,
            this.uiManager.investingLinksContainer,
            this.uiManager.onlineLinksContainer
        ];

        linkContainers.forEach(container => {
            container.addEventListener('click', (event) => {
                this.handleLinkItemClick(event);
            });

            container.addEventListener('change', (event) => {
                this.handleToggleClick(event);
            });
        });
    }

    async handleFormSubmit() {
        try {
            const editingId = this.uiManager.editingIdInput.value;
            const name = document.getElementById('name').value;
            const link = document.getElementById('link').value;
            const section = this.uiManager.sectionSelect.value;
            const tradesPerDay = document.getElementById('trades-per-day').value;

            if (!name || !link) {
                NotificationService.showError('Name and link are required.');
                return;
            }

            const linkData = {
                id: editingId ? Number(editingId) : null,
                name,
                link,
                section,
                tradesPerDay
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

    handleLinkItemClick(event) {
        const linkItem = event.target.closest('.link-item');
        if (!linkItem) return;

        const linkId = Number(linkItem.getAttribute('data-id'));

        if (event.target.classList.contains('edit-btn')) {
            const link = this.linkManager.getLinkById(linkId);
            if (link) {
                this.uiManager.populateFormForEdit(link);
            }
        } else if (event.target.classList.contains('delete-btn')) {
            this.linkManager.deleteLink(linkId);
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
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});
