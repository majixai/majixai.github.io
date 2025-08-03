export class UIManager {
    constructor() {
        this.linkForm = document.getElementById('link-form');
        this.linksContainer = document.getElementById('links-container');
        this.sectionSelect = document.getElementById('section');
        this.investingOptions = document.getElementById('investing-options');
        this.editingIdInput = document.getElementById('editingId');
        this.submitButton = this.linkForm.querySelector('button[type="submit"]');
    }

    renderLinks(links) {
        this.linksContainer.innerHTML = '';
        for (const link of links) {
            const linkElement = this.createLinkElement(link);
            this.linksContainer.appendChild(linkElement);
        }
    }

    createLinkElement(link) {
        const linkElement = document.createElement('div');
        linkElement.classList.add('link-item');
        linkElement.setAttribute('data-id', link.id);

        const isEnabled = link.isEnabled === undefined ? true : link.isEnabled;
        linkElement.innerHTML = `
            <label class="switch">
                <input type="checkbox" class="toggle-switch" ${isEnabled ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
            <a href="${link.link}" target="_blank">${link.name}</a>
            <span>(${link.section})</span>
            ${link.section === 'investing' ? ` - Trades: ${link.tradesPerDay}` : ''}
            <button class="edit-btn">Edit</button>
            <button class="delete-btn">Delete</button>
        `;
        return linkElement;
    }

    setupSectionToggle() {
        this.sectionSelect.addEventListener('change', () => {
            this.toggleInvestingOptions(this.sectionSelect.value === 'investing');
        });
    }

    toggleInvestingOptions(show) {
        this.investingOptions.style.display = show ? 'block' : 'none';
    }

    resetForm() {
        this.linkForm.reset();
        this.editingIdInput.value = '';
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
