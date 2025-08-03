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
        this.modal = document.getElementById('actions-modal');
        this.iframe = document.getElementById('link-iframe');
        this.currentLinkId = null;
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

        linkElement.innerHTML = `
            <div class="link-info">
                <a href="${link.link}" target="_blank">${link.name}</a>
                <p class="notes">${link.notes}</p>
                ${investingInfo}
            </div>
            <div class="controls">
                ${toggles}
                <div class="actions">
                    <button class="actions-btn w3-button w3-blue">Actions</button>
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

        const isInvesting = link.section === 'investing';
        this.toggleInvestingOptions(isInvesting);
        if (isInvesting) {
            this.tradesPerDayInput.value = link.tradesPerDay;
            this.tradesSlider.value = link.tradesPerDay;
        }
        this.submitButton.textContent = 'Update Link';
    }
}
