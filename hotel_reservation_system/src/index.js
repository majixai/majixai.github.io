// --- Immediately Invoked Function Expression (IIFE) ---
(function() {
    "use strict";

    // --- Configuration Object ---
    const AppConfig = {
        API_BASE_URL: '/api',
    };

    // --- Logger Class (Public Static Members) ---
    class Logger {
        static log(message, ...args) { console.log(`[LOG] ${new Date().toISOString()}: ${message}`, ...args); }
        static error(message, ...args) { console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args); }
    }

    // --- Interfaces & Structs (using Classes for structure) ---
    class Room {
        constructor({ id, name, description, price, image_url }) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.price = price;
            this.imageUrl = image_url;
        }
    }

    // --- API Service (Singleton & Async) ---
    const ApiService = (() => {
        let instance;
        const get = async (endpoint) => {
            const response = await fetch(`${AppConfig.API_BASE_URL}${endpoint}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        };
        const post = async (endpoint, data) => {
            const response = await fetch(`${AppConfig.API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return response.json();
        };
        return { getInstance: () => (instance || (instance = {
            getRooms: () => get('/rooms').then(data => data.map(r => new Room(r))),
            createBooking: (data) => post('/bookings', data),
        })) };
    })();

    // --- IndexedDB Service (Caching) ---
    const CacheService = (() => {
        const dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open('HotelCacheDB', 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore('bookings', { keyPath: 'id' });
            request.onsuccess = e => resolve(e.target.result);
            request.onerror = e => reject(e.target.errorCode);
        });
        const withStore = async (type, callback) => {
            const db = await dbPromise;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('bookings', type);
                tx.oncomplete = () => resolve();
                tx.onerror = e => reject(e.target.error);
                callback(tx.objectStore('bookings'));
            });
        };
        return {
            addBooking: async booking => withStore('readwrite', store => store.put(booking)),
        };
    })();

    // --- UI Controller ---
    class UIController {
        constructor() {
            Object.assign(this, {
                roomsContainer: $('#rooms-container'),
                bookingSection: $('#booking-section'),
                bookingForm: $('#booking-form'),
                confirmationSection: $('#confirmation-section'),
                bookingRoomName: $('#booking-room-name'),
                roomIdInput: $('#room-id'),
                guestNameInput: $('#guest-name'),
                guestEmailInput: $('#guest-email'),
                startDateInput: $('#start-date'),
                endDateInput: $('#end-date'),
                confirmationMessage: $('#confirmation-message'),
                animIcon: $('#anim-icon'),
                toggleLayoutButton: $('#toggle-layout'),
                isGridLayout: false,
            });
        }

        renderRooms(rooms) {
            Logger.log('Rendering rooms');
            this.roomsContainer.empty();
            const roomElements = rooms.map(this.createRoomCard.bind(this));
            this.roomsContainer.append(roomElements);
        }

        createRoomCard(room) {
            return $(`
                <div class="w3-card-4 m-3 room-card" style="width: 300px;">
                    <img src="${room.imageUrl}" alt="${room.name}" style="width:100%">
                    <div class="w3-container w3-center">
                        <h3>${room.name}</h3>
                        <p>${room.description}</p>
                        <p><strong>$${room.price.toFixed(2)} / night</strong></p>
                        <button class="w3-button w3-teal w3-margin-bottom book-btn" data-room-id="${room.id}" data-room-name="${room.name}">Book Now</button>
                    </div>
                </div>
            `);
        }

        showBookingForm(roomId, roomName) {
            Logger.log(`Showing booking form for room ${roomId}`);
            this.bookingRoomName.text(roomName);
            this.roomIdInput.val(roomId);
            this.bookingSection.slideDown();
            $('html, body').animate({ scrollTop: this.bookingSection.offset().top }, 1000);
        }

        hideBookingForm() { this.bookingSection.slideUp(); this.bookingForm[0].reset(); }

        showConfirmation(booking) {
            const { guestName, startDate, endDate, guestEmail, id } = booking;
            this.confirmationMessage.text(`Ahoy, ${guestName}! Your booking for ${this.bookingRoomName.text()} from ${startDate} to ${endDate} is confirmed. A parrot will be dispatched with the details to ${guestEmail}. Your booking ID is ${id}.`);
            this.confirmationSection.fadeIn();
        }

        toggleAnimation(start) { this.animIcon.toggleClass('w3-spin', start); }

        toggleLayout() {
            this.isGridLayout = !this.isGridLayout;
            this.roomsContainer.toggleClass('flex-container grid-container');
            this.toggleLayoutButton.text(this.isGridLayout ? 'Switch to Flexbox Layout' : 'Switch to Grid Layout');
        }
    }

    // --- Main App Controller ---
    class App {
        constructor(apiService, uiController, cacheService) {
            this.apiService = apiService;
            this.uiController = uiController;
            this.cacheService = cacheService;
            this.rooms = [];
        }

        async init() {
            Logger.log('App initializing...');
            try {
                this.rooms = await this.apiService.getRooms();
                this.uiController.renderRooms(this.rooms);
                this.addEventListeners();
            } catch (e) {
                Logger.error('Failed to initialize app.', e);
                this.uiController.roomsContainer.html('<p class="w3-text-red w3-center">Could not load rooms. Please try again later.</p>');
            }
        }

        addEventListeners() {
            this.uiController.roomsContainer.on('click', '.book-btn', e => {
                const { roomId, roomName } = $(e.currentTarget).data();
                this.uiController.showBookingForm(roomId, roomName);
            });

            this.uiController.bookingForm.on('submit', this.handleBookingSubmit.bind(this));
            $('#cancel-booking').on('click', () => this.uiController.hideBookingForm());
            $('.start-animation').on('click', () => this.uiController.toggleAnimation(true));
            $('.stop-animation').on('click', () => this.uiController.toggleAnimation(false));
            this.uiController.toggleLayoutButton.on('click', () => this.uiController.toggleLayout());
        }

        async handleBookingSubmit(e) {
            e.preventDefault();
            const bookingData = {
                room_id: parseInt(this.uiController.roomIdInput.val()),
                guest_name: this.uiController.guestNameInput.val(),
                guest_email: this.uiController.guestEmailInput.val(),
                check_in_date: this.uiController.startDateInput.val(),
                check_out_date: this.uiController.endDateInput.val(),
            };

            const FLAGS = { EMAIL_VALID: 1, DATES_VALID: 2 };
            let status = 0;
            if (/.+@.+\..+/.test(bookingData.guest_email)) status |= FLAGS.EMAIL_VALID;
            if (new Date(bookingData.start_date) < new Date(bookingData.end_date)) status |= FLAGS.DATES_VALID;

            if ((status & (FLAGS.EMAIL_VALID | FLAGS.DATES_VALID)) !== (FLAGS.EMAIL_VALID | FLAGS.DATES_VALID)) {
                alert('Invalid form data. Please check email and dates.');
                return;
            }

            try {
                const newBooking = await this.apiService.createBooking(bookingData);
                this.runBookingSuccessFlow(newBooking, () => {
                     Logger.log(`Booking ${newBooking.id} successfully processed and cached.`);
                });
            } catch (error) {
                Logger.error('Booking failed:', error);
                alert(`Booking failed: ${error.message}`);
            }
        }

        // Callback example
        runBookingSuccessFlow(booking, onCompleteCallback) {
            this.uiController.hideBookingForm();
            this.uiController.showConfirmation(booking);
            this.cacheService.addBooking(booking).then(onCompleteCallback).catch(Logger.error);
        }
    }

    // --- Generator Function Example ---
    function* idGenerator() { let id = 1; while (true) yield id++; }
    const bookingIdGenerator = idGenerator();

    // --- App Bootstrap ---
    $(document).ready(() => {
        const app = new App(ApiService.getInstance(), new UIController(), CacheService);
        app.init();
    });

})();
