export class ContactUIManager {
    constructor() {
        this.contactsListContainer = document.getElementById('contacts-list');
        this.contactForm = document.getElementById('contact-form');
        this.connectionForm = document.getElementById('connection-form');
        this.contactSelect1 = document.getElementById('contact-select-1');
        this.contactSelect2 = document.getElementById('contact-select-2');
    }

    renderContacts(contacts) {
        this.contactsListContainer.innerHTML = '';
        contacts.forEach(contact => {
            const contactElement = this.createContactElement(contact, contacts);
            this.contactsListContainer.appendChild(contactElement);
        });
        this.populateConnectionSelects(contacts);
    }

    createContactElement(contact, allContacts) {
        const contactElement = document.createElement('div');
        contactElement.classList.add('contact-item');
        contactElement.setAttribute('data-id', contact.id);

        const connections = contact.connections.map(connectionId => {
            const connectedContact = allContacts.find(c => c.id === connectionId);
            return connectedContact ? connectedContact.name : 'Unknown';
        }).join(', ');

        contactElement.innerHTML = `
            <p><strong>${contact.name}</strong></p>
            <p>Connections: ${connections || 'None'}</p>
        `;
        return contactElement;
    }

    populateConnectionSelects(contacts) {
        this.contactSelect1.innerHTML = '';
        this.contactSelect2.innerHTML = '';
        contacts.forEach(contact => {
            const option1 = document.createElement('option');
            option1.value = contact.id;
            option1.textContent = contact.name;
            this.contactSelect1.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = contact.id;
            option2.textContent = contact.name;
            this.contactSelect2.appendChild(option2);
        });
    }
}
