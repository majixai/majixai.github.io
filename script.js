class MenuApp {
    constructor() {
        this.links = [];
        this.db = null;
        this.initDB();
    }

    initDB() {
        const request = indexedDB.open('MenuDB', 1);

        request.onupgradeneeded = (event) => {
            this.db = event.target.result;
            this.db.createObjectStore('links', { keyPath: 'id', autoIncrement: true });
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.loadLinks();
        };

        request.onerror = (event) => {
            console.error('Database error:', event.target.errorCode);
        };
    }

    loadLinks() {
        const transaction = this.db.transaction(['links'], 'readonly');
        const objectStore = transaction.objectStore('links');
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            this.links = event.target.result;
            this.renderLinks();
        };
    }

    addLink(name, url) {
        const transaction = this.db.transaction(['links'], 'readwrite');
        const objectStore = transaction.objectStore('links');
        const newLink = { name, url };
        const request = objectStore.add(newLink);

        request.onsuccess = () => {
            this.links.push({ ...newLink, id: request.result });
            this.renderLinks();
        };
    }

    renderLinks() {
        const linkList = document.getElementById('link-list');
        linkList.innerHTML = '';
        this.links.forEach(link => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${link.url}">${link.name}</a>`;
            linkList.appendChild(li);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new MenuApp();

    const modal = document.getElementById('menu-modal');
    const btn = document.getElementById('menu-btn');
    const span = document.getElementsByClassName('close')[0];

    btn.onclick = () => {
        modal.style.display = 'block';
        btn.classList.add('spinning');
    };

    span.onclick = () => {
        modal.style.display = 'none';
        btn.classList.remove('spinning');
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
            btn.classList.remove('spinning');
        }
    };

    const addLinkForm = document.getElementById('add-link-form');
    addLinkForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const nameInput = document.getElementById('link-name');
        const urlInput = document.getElementById('link-url');
        app.addLink(nameInput.value, urlInput.value);
        nameInput.value = '';
        urlInput.value = '';
    });

    const linkList = document.getElementById('link-list');
    const iframe = document.getElementById('menu-iframe');

    linkList.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            iframe.src = event.target.href;
            modal.style.display = 'none';
        }
    });
});
