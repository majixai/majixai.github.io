class Play {
    #name;
    #down;
    #distance;
    #fieldLocation;
    #hash;
    #timeClock;

    constructor(name, down, distance, fieldLocation, hash, timeClock) {
        this.#name = name;
        this.#down = down;
        this.#distance = distance;
        this.#fieldLocation = fieldLocation;
        this.#hash = hash;
        this.#timeClock = timeClock;
    }

    get name() {
        return this.#name;
    }

    getDetails() {
        return `
            <strong>Down and Distance:</strong> ${this.#down} and ${this.#distance}<br>
            <strong>Field Location:</strong> ${this.#fieldLocation}<br>
            <strong>Hash:</strong> ${this.#hash}<br>
            <strong>Time Clock:</strong> ${this.#timeClock}
        `;
    }
}

class Formation {
    #name;
    #plays;

    constructor(name) {
        this.#name = name;
        this.#plays = [];
    }

    addPlay(play) {
        this.#plays.push(play);
    }

    get name() {
        return this.#name;
    }

    get plays() {
        return this.#plays;
    }
}

class Playbook {
    _formations;

    constructor() {
        this._formations = [];
    }

    addFormation(formation) {
        this._formations.push(formation);
    }

    get formations() {
        return this._formations;
    }
}

const dbName = "NFLPlaybookDB";
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            const objectStore = db.createObjectStore("formations", { keyPath: "name" });
            objectStore.createIndex("name", "name", { unique: true });
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("Database initialized");
            resolve();
        };

        request.onerror = function(event) {
            console.error("Database error: " + event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

function populateDB(playbook) {
    const transaction = db.transaction(["formations"], "readwrite");
    const objectStore = transaction.objectStore("formations");

    playbook.formations.forEach(formation => {
        objectStore.add(JSON.parse(JSON.stringify(formation, (key, value) => {
            if (key.startsWith('_') || key.startsWith('#')) {
                return undefined;
            }
            return value;
        })));
    });
}

function logFormationAdd(target, name, descriptor) {
    const original = descriptor.value;
    descriptor.value = function(...args) {
        console.log(`Adding formation: ${args[0].name}`);
        return original.apply(this, args);
    };
    return descriptor;
}

Object.defineProperty(Playbook.prototype, 'addFormation', logFormationAdd(Playbook.prototype, 'addFormation', Object.getOwnPropertyDescriptor(Playbook.prototype, 'addFormation')));

async function fetchPlaybookData() {
    const playbook = new Playbook();
    const formationFiles = ['4-3_defense.txt', '3-4_defense.txt', 'nickel_defense.txt', 'dime_defense.txt'];

    for (const file of formationFiles) {
        const response = await fetch(`data/${file}`);
        const text = await response.text();
        const lines = text.split('\n');
        const formationName = lines[0].replace('# ', '').replace(' Defense', '');
        const formation = new Formation(formationName);

        let currentPlay = null;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('**Play:**')) {
                if (currentPlay) {
                    formation.addPlay(currentPlay);
                }
                const playName = line.replace('**Play:** ', '');
                currentPlay = new Play(playName);
            } else if (line.startsWith('*   **Recommended Down and Distance:**')) {
                const parts = line.split(': ')[1].split(' and ');
                currentPlay.down = parts[0];
                currentPlay.distance = parts[1];
            } else if (line.startsWith('*   **Field Location:**')) {
                currentPlay.fieldLocation = line.split(': ')[1];
            } else if (line.startsWith('*   **Hash:**')) {
                currentPlay.hash = line.split(': ')[1];
            } else if (line.startsWith('*   **Time Clock:**')) {
                currentPlay.timeClock = line.split(': ')[1];
            }
        }
        if (currentPlay) {
            formation.addPlay(currentPlay);
        }
        playbook.addFormation(formation);
    }
    return playbook;
}

function* formationIterator(playbook) {
    for (const formation of playbook.formations) {
        yield formation;
    }
}

function displayPlaysGrid(playbook) {
    const gridContainer = document.querySelector('.grid-container');
    for (let i = 0; i < 150; i++) {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.innerHTML = `<h5>Play ${i + 1}</h5>`;
        gridContainer.appendChild(gridItem);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    const playbook = await fetchPlaybookData();
    populateDB(playbook);
    displayPlaysGrid(playbook);
});
