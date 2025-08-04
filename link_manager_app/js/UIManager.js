export class UIManager {
    constructor() {
        this.linkForm = document.getElementById('link-form');
        this.entitiesContainer = document.getElementById('entities-container');
        this.sectionSelect = document.getElementById('section');
        this.investingOptions = document.getElementById('investing-options');
        this.submitButton = this.linkForm.querySelector('button[type="submit"]');
        this.tradesPerDayInput = document.getElementById('trades-per-day');
        this.tradesSlider = document.getElementById('trades-slider');
        this.notesInput = document.getElementById('notes');
        this.attachmentTypeInput = document.getElementById('attachment-type');
        this.attachmentValueInput = document.getElementById('attachment-value');
        this.addAttachmentBtn = document.getElementById('add-attachment-btn');
        this.attachmentsList = document.getElementById('attachments-list');
        this.modal = document.getElementById('actions-modal');
        this.slotMachineModal = document.getElementById('slot-machine-modal');
        this.iframeContainer = document.getElementById('iframe-container');
        this.ledgerContainer = document.getElementById('ledger-container');
        this.ledgerEntriesContainer = document.getElementById('ledger-entries');
        this.ledgerForm = document.getElementById('ledger-form');
        this.calendarContainer = document.getElementById('calendar');
        this.contactsContainer = document.getElementById('contacts-container');
        this.currentLinkId = null;
        this.currentLedgerLinkId = null;
        this.attachments = [];
    }

    openSlotMachineModal() {
        this.slotMachineModal.style.display = 'block';
    }

    closeSlotMachineModal() {
        this.slotMachineModal.style.display = 'none';
    }

    switchView(view) {
        this.calendarContainer.style.display = 'none';
        this.iframeContainer.style.display = 'none';
        this.contactsContainer.style.display = 'none';

        switch (view) {
            case 'calendar':
                this.calendarContainer.style.display = 'block';
                break;
            case 'iframe':
                this.iframeContainer.style.display = 'block';
                break;
            case 'contacts':
                this.contactsContainer.style.display = 'block';
                break;
        }
    }

    renderEntities(entities) {
        this.entitiesContainer.innerHTML = '';
        entities.forEach(entity => {
            const entityElement = this.createEntityElement(entity);
            this.entitiesContainer.appendChild(entityElement);
        });
    }

    createEntityElement(entity) {
        const entityElement = document.createElement('div');
        entityElement.classList.add('entity-item');
        entityElement.innerHTML = `<h3>${entity.name}</h3>`;

        for (const sectionName in entity.sections) {
            const sectionElement = document.createElement('div');
            sectionElement.classList.add('section');
            sectionElement.innerHTML = `<h4>${sectionName}</h4>`;

            const linkList = document.createElement('ul');
            entity.sections[sectionName].forEach(link => {
                const linkItem = this.createLinkElement(link);
                linkList.appendChild(linkItem);
            });

            sectionElement.appendChild(linkList);
            entityElement.appendChild(sectionElement);
        }

        return entityElement;
    }

    createLinkElement(link) {
        const linkElement = document.createElement('li');
        linkElement.classList.add('link-item');
        linkElement.setAttribute('data-id', link.id);

        const attachmentsHTML = link.attachments.map(attachment => `
            <div class="attachment-item">
                <strong>${attachment.type}:</strong> ${attachment.value}
            </div>
        `).join('');

        linkElement.innerHTML = `
            <a href="${link.link}" target="_blank">${link.link}</a>
            <p class="notes">${link.notes}</p>
            <div class="attachments">${attachmentsHTML}</div>
        `;
        return linkElement;
    }

    renderAttachments() {
        this.attachmentsList.innerHTML = '';
        this.attachments.forEach((attachment, index) => {
            const li = document.createElement('li');
            li.textContent = `${attachment.type}: ${attachment.value}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => {
                this.attachments.splice(index, 1);
                this.renderAttachments();
            };
            li.appendChild(removeBtn);
            this.attachmentsList.appendChild(li);
        });
    }

    setupSectionToggle() {
        this.sectionSelect.addEventListener('change', () => {
            const isInvesting = this.sectionSelect.value === 'investing';
            this.toggleInvestingOptions(isInvesting);
        });

        this.tradesSlider.addEventListener('input', () => {
            this.tradesPerDayInput.value = this.tradesSlider.value;
        });

        this.tradesPerDayInput.addEventListener('input', () => {
            this.tradesSlider.value = this.tradesPerDayInput.value;
        });
    }

    toggleInvestingOptions(show) {
        this.investingOptions.style.display = show ? 'block' : 'none';
    }

    resetForm() {
        this.linkForm.reset();
        this.notesInput.value = '';
        this.attachments = [];
        this.renderAttachments();
        this.tradesPerDayInput.value = 1;
        this.tradesSlider.value = 1;
        this.toggleInvestingOptions(false);
        this.submitButton.textContent = 'Add Link';
    }
}
