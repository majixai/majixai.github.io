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
            const objectStore = this.db.createObjectStore('links', { keyPath: 'id', autoIncrement: true });

            const originalLinks = [
                { name: 'The VAS Community', url: 'https://thevascommunity.com/' },
                { name: 'HAI Community AI', url: 'https://haicommunityai.com/sign/' },
                { name: 'The CAI Community', url: 'https://thecaicommunity.com/sign/' },
                { name: 'Dirfn', url: 'https://dirfn.com/#/pages/home/home' },
                { name: 'Bote Finance Institute', url: 'https://www.botefinanceinstitute.com/#/user/info' },
                { name: 'AIAIIS', url: 'https://www.aiaiis.net/#/' },
                { name: 'Lakshmi Finance', url: 'https://www.lakshmifinance.com/#/online-event' },
                { name: 'Solid Rockes', url: 'https://www.solidrockes.com/#/' },
                { name: 'EMXJ', url: 'https://www.emxj.com/#/luckdraw' },
                { name: 'Full Force Cultures', url: 'https://fullforcecultures.com/pages/user/taskRecord' },
                { name: 'BCBIT AI', url: 'https://m.bcbit-ai.cc/#/pages/mine/login' },
                { name: 'Block Crypto', url: 'https://www.blockcrypto.info/#/pages/login/rego' },
                { name: 'CJ Go With AC', url: 'https://cj.gowithac.org/' },
                { name: 'Private Key Tracer', url: 'https://privatekeytracer.cc/#!/main' },
            ];

            originalLinks.forEach(link => {
                objectStore.add(link);
            });
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
            iframe.classList.add('loading');
            iframe.src = event.target.href;
            modal.style.display = 'none';
        }
    });

    iframe.addEventListener('load', () => {
        iframe.classList.remove('loading');
    });

    const parallax = document.querySelector('.parallax');
    window.addEventListener('scroll', () => {
        const offset = window.pageYOffset;
        parallax.style.backgroundPositionY = offset * 0.7 + 'px';
    });
});
