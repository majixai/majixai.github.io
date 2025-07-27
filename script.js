$(document).ready(() => {
    const menuList = $('#menu-list');
    const addLinkContainer = $('#add-link-container');
    const calendarModal = $('#calendar-modal');
    const monthYear = $('#month-year');
    const calendarDays = $('#calendar-days');

    let today = new Date();
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();
    let menuData = {
        links: [],
        clickCounts: {}
    };

    // Function to render the menu
    function renderMenu() {
        menuList.empty();
        menuData.links.forEach(linkData => {
            const link = $('<a></a>').attr('href', linkData.url).attr('target', '_blank').text(linkData.text);
            const counter = $('<span></span>').addClass('click-counter').text(menuData.clickCounts[linkData.url] || 0);
            const listItem = $('<li></li>').append(link).append(counter);
            menuList.append(listItem);

            link.on('click', (e) => {
                e.preventDefault();
                menuData.clickCounts[linkData.url] = (menuData.clickCounts[linkData.url] || 0) + 1;
                counter.text(menuData.clickCounts[linkData.url]);
                localStorage.setItem('clickCounts', JSON.stringify(menuData.clickCounts));
                window.open(linkData.url, '_blank');
                calendarModal.show();
                renderCalendar(currentMonth, currentYear);
            });
        });
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
            menuData.links.push({ text, url });
            renderMenu();
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
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(menuData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "menu-state.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Load links from file
    $('#load-btn').on('click', async () => {
        try {
            const [fileHandle] = await window.showOpenFilePicker();
            const file = await fileHandle.getFile();
            const contents = await file.text();
            menuData = JSON.parse(contents);
            renderMenu();
        } catch (error) {
            console.error('Error loading file:', error);
        }
    });

    // Function to load menu data
    function loadMenuData(url) {
        $.ajax({
            url: url,
            dataType: 'json',
            success: function(data) {
                menuData = data;
                renderMenu();
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error loading menu data:', textStatus, errorThrown);
            }
        });
    }

    // Initial load
    loadMenuData('json/menu.json');
});
