import { StorageService } from './StorageService.js';

export class CalendarManager {
    constructor(calendarEl) {
        this.calendarEl = calendarEl;
        this.storageKey = 'calendarEvents';
        this.calendar = null;
    }

    async initialize() {
        const events = await StorageService.get(this.storageKey);
        this.calendar = new FullCalendar.Calendar(this.calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: events,
            selectable: true,
            select: this.handleDateSelect.bind(this),
            eventClick: this.handleEventClick.bind(this),
        });
        this.calendar.render();
    }

    async handleDateSelect(info) {
        const title = prompt('Enter Event Title:');
        if (title) {
            const newEvent = {
                title,
                start: info.startStr,
                end: info.endStr,
                allDay: info.allDay,
                id: Date.now().toString()
            };
            this.calendar.addEvent(newEvent);
            const events = await StorageService.get(this.storageKey);
            events.push(newEvent);
            await StorageService.save(this.storageKey, events);
        }
        this.calendar.unselect();
    }

    async handleEventClick(info) {
        if (confirm(`Are you sure you want to delete the event "${info.event.title}"?`)) {
            info.event.remove();
            let events = await StorageService.get(this.storageKey);
            events = events.filter(event => event.id !== info.event.id);
            await StorageService.save(this.storageKey, events);
        }
    }
}
