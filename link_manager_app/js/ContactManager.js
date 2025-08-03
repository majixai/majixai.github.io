import { StorageService } from './StorageService.js';
import { Contact } from './Contact.js';

export class ContactManager {
    #contacts;

    constructor(uiManager) {
        this.uiManager = uiManager;
        this.#contacts = [];
        this.storageKey = 'contacts';
    }

    async loadContacts() {
        const contactsData = await StorageService.get(this.storageKey);
        this.#contacts = contactsData.map(data => new Contact(data));
        this.uiManager.renderContacts(this.#contacts);
    }

    async addContact(data) {
        const newContact = new Contact(data);
        this.#contacts.push(newContact);
        await StorageService.save(this.storageKey, this.#contacts);
        this.uiManager.renderContacts(this.#contacts);
    }

    async addConnection(contactId, connectionId) {
        const contact = this.getContactById(contactId);
        if (contact) {
            contact.connections.push(connectionId);
            await StorageService.save(this.storageKey, this.#contacts);
            this.uiManager.renderContacts(this.#contacts);
        }
    }

    getContactById(id) {
        return this.#contacts.find(contact => contact.id === id);
    }

    getAllContacts() {
        return this.#contacts;
    }
}
