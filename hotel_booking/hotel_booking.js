// hotel_booking.js
// Advanced OOP, IndexedDB, SVG animation, async, iterators, decorators, etc.

// --- IndexedDB Wrapper (Class, IIFE, Interface-like) ---
const IDB = (() => {
    class IDBWrapper {
        #dbName = 'HotelBookingDB';
        #storeName = 'bookings';
        constructor() {
            this.db = null;
        }
        async open() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(this.#dbName, 1);
                req.onupgradeneeded = e => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.#storeName)) {
                        db.createObjectStore(this.#storeName, { keyPath: 'id', autoIncrement: true });
                    }
                };
                req.onsuccess = e => {
                    this.db = e.target.result;
                    resolve(this.db);
                };
                req.onerror = e => reject(e);
            });
        }
        async addBooking(booking) {
            await this.open();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(this.#storeName, 'readwrite');
                const store = tx.objectStore(this.#storeName);
                const req = store.add(booking);
                req.onsuccess = () => resolve(req.result);
                req.onerror = e => reject(e);
            });
        }
        async getAllBookings() {
            await this.open();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(this.#storeName, 'readonly');
                const store = tx.objectStore(this.#storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = e => reject(e);
            });
        }
    }
    return new IDBWrapper();
})();

// --- Decorator (for logging) ---
function logDecorator(fn) {
    return function(...args) {
        console.log('Calling', fn.name, 'with', args);
        return fn.apply(this, args);
    };
}

// --- Booking Struct/Interface ---
function BookingStruct(name, date, roomType) {
    return { name, date, roomType };
}

// --- OOP: HotelBooking Class ---
class HotelBooking {
    static bookings = [];
    #privateField = 'secret';
    _protectedField = 'protected';
    publicField = 'public';
    constructor(name, date, roomType) {
        this.name = name;
        this.date = date;
        this.roomType = roomType;
    }
    static async add(booking) {
        HotelBooking.bookings.push(booking);
        await IDB.addBooking(booking);
    }
    static async *iterator() {
        const all = await IDB.getAllBookings();
        for (let b of all) yield b;
    }
    static bitwiseRoomType(roomType) {
        // Single: 1, Double: 2, Suite: 4
        const map = { single: 1, double: 2, suite: 4 };
        return map[roomType] || 0;
    }
    getPrivate() { return this.#privateField; }
    getProtected() { return this._protectedField; }
    getPublic() { return this.publicField; }
}

// --- SVG Animation (start/stop) ---
let animInterval = null;
function animateSVG(start = true) {
    const pulse = document.getElementById('pulse');
    let grow = true, r = 20;
    if (start) {
        if (animInterval) return;
        animInterval = setInterval(() => {
            r += grow ? 1 : -1;
            if (r > 35) grow = false;
            if (r < 20) grow = true;
            pulse.setAttribute('r', r);
        }, 30);
    } else {
        clearInterval(animInterval);
        animInterval = null;
        pulse.setAttribute('r', 20);
    }
}
function toggleAnimation() {
    animateSVG(!animInterval);
}

// --- Parallax (simple) ---
window.addEventListener('scroll', () => {
    const parallax = document.querySelector('.parallax');
    parallax.style.backgroundPositionY = `${window.scrollY * 0.5}px`;
});

// --- Booking Form Handler ---
document.getElementById('bookingForm').addEventListener('submit', logDecorator(async function(e) {
    e.preventDefault();
    const name = document.getElementById('nameInput').value;
    const date = document.getElementById('dateInput').value;
    const roomType = document.getElementById('roomTypeInput').value;
    const booking = BookingStruct(name, date, roomType);
    await HotelBooking.add(booking);
    document.getElementById('bookingResult').textContent = 'Booking saved!';
    renderBookings();
}));

// --- Render Bookings (uses async iterator) ---
async function renderBookings() {
    const ul = document.getElementById('bookingList');
    ul.innerHTML = '';
    for await (let b of HotelBooking.iterator()) {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `${b.name} - ${b.date} - ${b.roomType} (bitwise: ${HotelBooking.bitwiseRoomType(b.roomType)})`;
        ul.appendChild(li);
    }
}
renderBookings();

// --- GenAI Form Handler (rate-limited, only works if Flask server is running) ---
document.getElementById('genaiForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const prompt = document.getElementById('genaiPrompt').value;
    const resultDiv = document.getElementById('genaiResult');
    resultDiv.textContent = 'Thinking...';
    try {
        const resp = await axios.post('/genai', { prompt });
        resultDiv.textContent = resp.data.result || JSON.stringify(resp.data);
    } catch (err) {
        resultDiv.textContent = 'Error: ' + (err.response?.data?.error || err.message);
    }
});

// --- Example of IIFE, Object Mapping, Struct, Interface-like usage ---
(function() {
    const roomTypes = ['single', 'double', 'suite'];
    const roomMap = Object.fromEntries(roomTypes.map((type, i) => [type, { id: i+1, label: type.charAt(0).toUpperCase()+type.slice(1) }]));
    window.roomMap = roomMap; // for debug
})();

// --- Example of using bitwise operations for room features ---
// Features: 1 = WiFi, 2 = Breakfast, 4 = Pool
function featuresToString(features) {
    let s = [];
    if (features & 1) s.push('WiFi');
    if (features & 2) s.push('Breakfast');
    if (features & 4) s.push('Pool');
    return s.join(', ');
}
// Usage: featuresToString(1|4) => 'WiFi, Pool'

// --- Interface-like for Booking (JS doesn't have interfaces, but we can check shape) ---
function isBooking(obj) {
    return obj && typeof obj.name === 'string' && typeof obj.date === 'string' && typeof obj.roomType === 'string';
}
