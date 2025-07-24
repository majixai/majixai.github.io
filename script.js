// Logger decorator
function log(target, name, descriptor) {
  const original = descriptor.value;
  descriptor.value = function(...args) {
    console.log(`Calling ${name} with`, args);
    return original.apply(this, args);
  };
  return descriptor;
}

class WebApp {
  constructor() {
    this._users = [];
    this.db = null;
    this.initDB();
    this.init();
  }

  initDB() {
    const request = indexedDB.open('WebAppDB', 1);

    request.onupgradeneeded = (event) => {
      this.db = event.target.result;
      if (!this.db.objectStoreNames.contains('users')) {
        this.db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      this.db = event.target.result;
      this.displayUsers();
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.errorCode);
    };
  }

  // Private method
  _addUser(user) {
    this._users.push(user);
  }

  // Public method
  @log
  addUser(name, email, skills) {
    const user = { name, email, skills };
    const transaction = this.db.transaction(['users'], 'readwrite');
    const objectStore = transaction.objectStore('users');
    const request = objectStore.add(user);

    request.onsuccess = () => {
      this.displayUsers();
    };
  }

  // Static method
  static get PI() {
    return 3.14159;
  }

  // Generator
  *userGenerator() {
    for (const user of this._users) {
      yield user;
    }
  }

  // Iterator
  [Symbol.iterator]() {
    let index = 0;
    return {
      next: () => {
        if (index < this._users.length) {
          return { value: this._users[index++], done: false };
        } else {
          return { done: true };
        }
      }
    };
  }

  // Async method
  async fetchData() {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const data = await response.json();
      console.log('Fetched data:', data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  displayUsers() {
    if (!this.db) return;
    const userList = document.getElementById('job-seekers-list');
    if (userList) {
      userList.innerHTML = '';
      const objectStore = this.db.transaction('users').objectStore('users');
      objectStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const userElement = document.createElement('div');
          userElement.innerHTML = `
            <p><strong>Name:</strong> ${cursor.value.name}</p>
            <p><strong>Email:</strong> ${cursor.value.email}</p>
            <p><strong>Skills:</strong> ${cursor.value.skills}</p>
          `;
          userList.appendChild(userElement);
          cursor.continue();
        }
      };
    }
  }

  init() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const skills = document.getElementById('skills').value;
        this.addUser(name, email, skills);
      });
    }

    const startButton = document.getElementById('start-animation');
    const stopButton = document.getElementById('stop-animation');
    const animatedRect = document.getElementById('animated-rect');

    if (startButton && stopButton && animatedRect) {
      startButton.addEventListener('click', () => {
        animatedRect.style.animationPlayState = 'running';
      });

      stopButton.addEventListener('click', () => {
        animatedRect.style.animationPlayState = 'paused';
      });
    }

    const getDataButton = document.getElementById('get-data');
    if (getDataButton) {
      getDataButton.addEventListener('click', () => {
        google.script.run.withSuccessHandler((data) => {
          document.getElementById('data-from-gas').innerText = data;
        }).getUnreadEmails();
      });
    }

    this.fetchData();
  }
}

// Wrapper for the WebApp class
const app = new WebApp();

// Protected member (by convention)
WebApp.prototype._protectedMethod = function() {
  console.log('This is a protected method.');
};
