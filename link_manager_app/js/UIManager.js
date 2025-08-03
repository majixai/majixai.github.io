export class UIManager {
    constructor() {
        this.linkForm = document.getElementById('link-form');
        this.chatLinksContainer = document.getElementById('chat-links');
        this.investingLinksContainer = document.getElementById('investing-links');
        this.onlineLinksContainer = document.getElementById('online-links');
        this.sectionSelect = document.getElementById('section');
        this.investingOptions = document.getElementById('investing-options');
        this.editingIdInput = document.getElementById('editingId');
        this.submitButton = this.linkForm.querySelector('button[type="submit"]');
        this.tradesPerDayInput = document.getElementById('trades-per-day');
        this.tradesSlider = document.getElementById('trades-slider');
        this.notesInput = document.getElementById('notes');
        this.attachmentTypeInput = document.getElementById('attachment-type');
        this.attachmentValueInput = document.getElementById('attachment-value');
        this.addAttachmentBtn = document.getElementById('add-attachment-btn');
        this.attachmentsList = document.getElementById('attachments-list');
        this.modal = document.getElementById('actions-modal');
        this.iframe = document.getElementById('link-iframe');
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

    showLedger(link) {
        this.currentLedgerLinkId = link.id;
        this.renderLedger(link);
    }

    renderLedger(link) {
        this.ledgerContainer.style.display = 'block';
        this.ledgerEntriesContainer.innerHTML = '';
        if (link.ledger.length === 0) {
            this.ledgerEntriesContainer.innerHTML = '<p>No ledger entries yet.</p>';
            return;
        }

        const table = document.createElement('table');
        table.classList.add('w3-table-all');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${link.ledger.map(entry => `
                    <tr>
                        <td>${entry.date}</td>
                        <td>${entry.description}</td>
                        <td>${entry.amount}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        this.ledgerEntriesContainer.appendChild(table);
    }

    renderEntireLedger(links) {
        this.ledgerContainer.style.display = 'block';
        this.ledgerEntriesContainer.innerHTML = '';
        const allEntries = links.flatMap(link => link.ledger.map(entry => ({ ...entry, linkName: link.name })));

        if (allEntries.length === 0) {
            this.ledgerEntriesContainer.innerHTML = '<p>No ledger entries yet.</p>';
            return;
        }

        const table = document.createElement('table');
        table.classList.add('w3-table-all');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Link</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${allEntries.map(entry => `
                    <tr>
                        <td>${entry.linkName}</td>
                        <td>${entry.date}</td>
                        <td>${entry.description}</td>
                        <td>${entry.amount}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        this.ledgerEntriesContainer.appendChild(table);
    }

    loadUrlInIframe(url) {
        this.iframe.src = url;
    }

    openModal(linkId) {
        this.currentLinkId = linkId;
        this.modal.style.display = 'block';
    }

    closeModal() {
        this.currentLinkId = null;
        this.modal.style.display = 'none';
    }

    renderLinks(links) {
        this.chatLinksContainer.innerHTML = '';
        this.investingLinksContainer.innerHTML = '';
        this.onlineLinksContainer.innerHTML = '';

        for (const link of links) {
            const linkElement = this.createLinkElement(link);
            switch (link.section) {
                case 'chat':
                    this.chatLinksContainer.appendChild(linkElement);
                    break;
                case 'investing':
                    this.investingLinksContainer.appendChild(linkElement);
                    break;
                case 'online':
                    this.onlineLinksContainer.appendChild(linkElement);
                    break;
            }
        }
    }

    createLinkElement(link) {
        const linkElement = document.createElement('div');
        linkElement.classList.add('link-item');
        linkElement.setAttribute('data-id', link.id);

        const isEnabled = link.isEnabled === undefined ? true : link.isEnabled;
        const isComplete = link.complete;
        const isIp = link.ip;

        let toggles = `
            <label class="switch">
                <input type="checkbox" class="toggle-switch" ${isEnabled ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
        `;

        if (link.section === 'chat' || link.section === 'online') {
            toggles += `
                <label class="switch">
                    <span>Complete</span>
                    <input type="checkbox" class="complete-toggle" ${isComplete ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
                <label class="switch">
                    <span>IP</span>
                    <input type="checkbox" class="ip-toggle" ${isIp ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;
        }

        let investingInfo = '';
        if (link.section === 'investing') {
            investingInfo = `
                <div class="investing-info">
                    <span>Trades: ${link.tradesPerDay}</span>
                    <input type="range" min="1" max="10" value="${link.tradesPerDay}" class="trade-slider" disabled>
                </div>
            `;
        }

        const attachmentsHTML = link.attachments.map(attachment => `
            <div class="attachment-item">
                <strong>${attachment.type}:</strong> ${attachment.value}
            </div>
        `).join('');

        linkElement.innerHTML = `
            <div class="link-info">
                <a href="${link.link}" target="_blank">${link.name}</a>
                <p class="notes">${link.notes}</p>
                <div class="attachments">${attachmentsHTML}</div>
                ${investingInfo}
            </div>
            <div class="controls">
                ${toggles}
                <div class="actions">
                    <button class="actions-btn w3-button w3-blue">Actions</button>
                    <button class="ledger-btn w3-button w3-green">Ledger</button>
                </div>
            </div>
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
        this.editingIdInput.value = '';
        this.notesInput.value = '';
        this.attachments = [];
        this.renderAttachments();
        this.tradesPerDayInput.value = 1;
        this.tradesSlider.value = 1;
        this.toggleInvestingOptions(false);
        this.submitButton.textContent = 'Add Link';
    }

    populateFormForEdit(link) {
        this.editingIdInput.value = link.id;
        document.getElementById('name').value = link.name;
        document.getElementById('link').value = link.link;
        this.sectionSelect.value = link.section;
        this.notesInput.value = link.notes;
        this.attachments = [...link.attachments];
        this.renderAttachments();

        const isInvesting = link.section === 'investing';
        this.toggleInvestingOptions(isInvesting);
        if (isInvesting) {
            this.tradesPerDayInput.value = link.tradesPerDay;
            this.tradesSlider.value = link.tradesPerDay;
        }
        this.submitButton.textContent = 'Update Link';
    }
}
