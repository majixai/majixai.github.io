$(document).ready(() => {
    const addLinkContainer = $('#add-link-container');
    const calendarModal = $('#calendar-modal');
    const monthYear = $('#month-year');
    const calendarDays = $('#calendar-days');

    let today = new Date();
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();

    // Load click counts from local storage
    let clickCounts = JSON.parse(localStorage.getItem('clickCounts')) || {};
    let lastReset = localStorage.getItem('lastReset');
    const todayString = today.toDateString();

    if (lastReset !== todayString) {
        clickCounts = {};
        localStorage.setItem('lastReset', todayString);
    }

    // Function to render the calendar
    function renderCalendar(month, year) {
        calendarDays.empty();
        monthYear.text(`${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`);
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            calendarDays.append('<div></div>');
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = $('<div></div>').addClass('calendar-day').text(i);
            dayCell.on('click', () => {
                console.log(`Clicked on ${i}/${month + 1}/${year}`);
                calendarModal.hide();
            });
            calendarDays.append(dayCell);
        }
    }

    // Event listeners for calendar navigation
    $('#prev-month').on('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar(currentMonth, currentYear);
    });

    $('#next-month').on('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar(currentMonth, currentYear);
    });

    // Add click counters and event listeners to links
    $('ul a').each(function() {
        const link = $(this);
        const url = link.attr('href');
        const counter = $('<span></span>').addClass('click-counter').text(clickCounts[url] || 0);
        link.parent().append(counter);

        link.on('click', (e) => {
            e.preventDefault();
            clickCounts[url] = (clickCounts[url] || 0) + 1;
            counter.text(clickCounts[url]);
            localStorage.setItem('clickCounts', JSON.stringify(clickCounts));
            window.open(url, '_blank');
            calendarModal.show();
            renderCalendar(currentMonth, currentYear);
        });
    });

    // Add new link form
    addLinkContainer.html(`
        <h3>Add New Link</h3>
        <input type="text" id="link-text" placeholder="Link Text">
        <input type="text" id="link-url" placeholder="Link URL">
        <button id="add-link-btn">Add Link</button>
    `);

    $('#add-link-btn').on('click', () => {
        const text = $('#link-text').val();
        const url = $('#link-url').val();

        if (text && url) {
            const newLink = $('<a></a>').attr('href', url).attr('target', '_blank').text(text);
            const counter = $('<span></span>').addClass('click-counter').text(0);
            const newListItem = $('<li></li>').append(newLink).append(counter);
            $('ul').append(newListItem);

            newLink.on('click', (e) => {
                e.preventDefault();
                clickCounts[url] = (clickCounts[url] || 0) + 1;
                counter.text(clickCounts[url]);
                localStorage.setItem('clickCounts', JSON.stringify(clickCounts));
                window.open(url, '_blank');
                calendarModal.show();
                renderCalendar(currentMonth, currentYear);
            });

            $('#link-text').val('');
            $('#link-url').val('');
        }
    });

    // Close modal
    $(window).on('click', (e) => {
        if (e.target === calendarModal[0]) {
            calendarModal.hide();
        }
    });

    // Download state
    $('#download-btn').on('click', () => {
        const data = {
            links: [],
            clickCounts: JSON.parse(localStorage.getItem('clickCounts')) || {}
        };

        $('ul a').each(function() {
            const link = $(this);
            data.links.push({
                text: link.text(),
                url: link.attr('href')
            });
        });

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "menu-state.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
});
