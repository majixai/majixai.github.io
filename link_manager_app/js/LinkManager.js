import { StorageService } from './StorageService.js';
import { Link } from './Link.js';
import { NotificationService } from './NotificationService.js';

export class LinkManager {
    #links;

    constructor(uiManager) {
        this.uiManager = uiManager;
        this.#links = [];
        this.storageKey = 'links';
    }

    async loadLinks() {
        const linksData = await StorageService.get(this.storageKey);
        this.#links = linksData.map(data => new Link(data));
        this.uiManager.renderLinks(this.#links);
    }

    async addLink(data) {
        const newLink = new Link(data);
        this.#links.push(newLink);
        await StorageService.save(this.storageKey, this.#links);
        this.uiManager.renderLinks(this.#links);
        NotificationService.showSuccess('Link added successfully!');
    }

    async updateLink(data) {
        const linkIndex = this.#links.findIndex(l => l.id === Number(data.id));
        if (linkIndex > -1) {
            this.#links[linkIndex] = new Link({ ...this.#links[linkIndex], ...data });
            await StorageService.save(this.storageKey, this.#links);
            this.uiManager.renderLinks(this.#links);
            NotificationService.showSuccess('Link updated successfully!');
        }
    }

    async deleteLink(id) {
        this.#links = this.#links.filter(link => link.id !== id);
        await StorageService.save(this.storageKey, this.#links);
        this.uiManager.renderLinks(this.#links);
        NotificationService.showSuccess('Link deleted successfully!');
    }

    async toggleLink(id) {
        const link = this.getLinkById(id);
        if(link) {
            link.isEnabled = !link.isEnabled;
            await StorageService.save(this.storageKey, this.#links);
        }
    }

    async toggleLinkProperty(id, property) {
        const link = this.getLinkById(id);
        if (link && typeof link[property] === 'boolean') {
            link[property] = !link[property];
            await StorageService.save(this.storageKey, this.#links);
            this.uiManager.renderLinks(this.#links);
        }
    }

    getLinkById(id) {
        return this.#links.find(link => link.id === id);
    }

    *getLinksBySection(section) {
        for (const link of this.#links) {
            if (link.section === section) {
                yield link;
            }
        }
    }

    async addLedgerEntry(linkId, entry) {
        const link = this.getLinkById(linkId);
        if (link) {
            link.ledger.push(entry);
            await StorageService.save(this.storageKey, this.#links);
            this.uiManager.renderLedger(link);
            NotificationService.showSuccess('Ledger entry added successfully!');
        }
    }

    getAllLinks() {
        return this.#links;
    }
}
