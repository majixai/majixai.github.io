class Calendar {
    constructor(containerId) {
        this.container = $(`#${containerId}`);
        this.monthYear = this.container.find('#month-year');
        this.calendarDays = this.container.find('#calendar-days');
        this.prevMonthBtn = this.container.find('#prev-month');
        this.nextMonthBtn = this.container.find('#next-month');
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();

        this.prevMonthBtn.on('click', () => this.changeMonth(-1));
        this.nextMonthBtn.on('click', () => this.changeMonth(1));

        this.loadCalendarData();
    }

    changeMonth(offset) {
        this.currentMonth += offset;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.loadCalendarData();
    }

    loadCalendarData() {
        $.ajax({
            url: `calendar.json`,
            dataType: 'json',
            success: (data) => {
                this.renderCalendar(data);
            },
            error: (jqXHR, textStatus, errorThrown) => {
                console.error('Error loading calendar data:', textStatus, errorThrown);
            }
        });
    }

    renderCalendar(data) {
        this.calendarDays.empty();
        this.monthYear.text(`${new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' })} ${data.year}`);

        data.calendar.forEach(week => {
            week.forEach(day => {
                if (day === 0) {
                    this.calendarDays.append('<div></div>');
                } else {
                    const dayCell = $('<div></div>').addClass('calendar-day').text(day);
                    dayCell.on('click', () => {
                        console.log(`Clicked on ${day}/${data.month}/${data.year}`);
                        this.container.hide();
                    });
                    this.calendarDays.append(dayCell);
                }
            });
        });
    }
}
