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

        linkElement.innerHTML = `
            <div class="link-info">
                <a href="${link.link}" target="_blank">${link.name}</a>
                <span class="section-info">
                    ${link.section === 'investing' ? ` - Trades: ${link.tradesPerDay}` : ''}
                </span>
            </div>
            <div class="controls">
                ${toggles}
                <div class="actions">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </div>
            </div>
        `;
        return linkElement;
    }

    setupSectionToggle() {
        this.sectionSelect.addEventListener('change', () => {
            const isInvesting = this.sectionSelect.value === 'investing';
            this.toggleInvestingOptions(isInvesting);
        });
    }

    toggleInvestingOptions(show) {
        this.investingOptions.style.display = show ? 'block' : 'none';
    }

    resetForm() {
        this.linkForm.reset();
        this.editingIdInput.value = '';
        this.tradesPerDayInput.value = 1;
        this.toggleInvestingOptions(false);
        this.submitButton.textContent = 'Add Link';
    }

    populateFormForEdit(link) {
        this.editingIdInput.value = link.id;
        document.getElementById('name').value = link.name;
        document.getElementById('link').value = link.link;
        this.sectionSelect.value = link.section;

        const isInvesting = link.section === 'investing';
        this.toggleInvestingOptions(isInvesting);
        if (isInvesting) {
            document.getElementById('trades-per-day').value = link.tradesPerDay;
        }
        this.submitButton.textContent = 'Update Link';
    }
}
