const dbName = 'footballGameDB';
const dbVersion = 1;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = (event) => {
      reject('Error opening IndexedDB');
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('gameState', { keyPath: 'id' });
    };
  });
}

function saveGameState(gameState) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gameState'], 'readwrite');
    const store = transaction.objectStore('gameState');
    const request = store.put({ id: 'current', ...gameState });

    request.onerror = (event) => {
      reject('Error saving game state');
    };

    request.onsuccess = (event) => {
      resolve();
    };
  });
}

function loadGameState() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gameState'], 'readonly');
    const store = transaction.objectStore('gameState');
    const request = store.get('current');

    request.onerror = (event) => {
      reject('Error loading game state');
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}
