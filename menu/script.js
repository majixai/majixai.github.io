$(document).ready(() => {
    const menuList = $('#menu-list');
    const addLinkContainer = $('#add-link-container');
    const calendarDays = $('#calendar-days');
    const monthYear = $('#month-year');

    let menuData = {
        links: [],
        clickCounts: {}
    };

    // Function to render the menu
    function renderMenu(filter = 'all') {
        menuList.empty();
        const filteredLinks = menuData.links.filter(link => filter === 'all' || link.type === filter);

        filteredLinks.forEach(linkData => {
            const link = $('<a></a>').attr('href', linkData.url).attr('target', '_blank').text(linkData.text);
            const counter = $('<span></span>').addClass('click-counter').text(menuData.clickCounts[linkData.url] || 0);
            const listItem = $('<li></li>').append(link).append(counter);
            menuList.append(listItem);

            link.on('click', (e) => {
                e.preventDefault();
                menuData.clickCounts[linkData.url] = (menuData.clickCounts[linkData.url] || 0) + 1;
                localStorage.setItem('menuData', JSON.stringify(menuData));
                counter.text(menuData.clickCounts[linkData.url]);
                window.open(linkData.url, '_blank');
            });
        });
    }

    $('#link-type-filter').on('change', function() {
        renderMenu($(this).val());
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
            menuData.links.push({text, url});
            localStorage.setItem('menuData', JSON.stringify(menuData));
            renderMenu();
            $('#link-text').val('');
            $('#link-url').val('');
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
            const loadedData = JSON.parse(contents);
            menuData = loadedData;
            localStorage.setItem('menuData', JSON.stringify(menuData));
            renderMenu();
        } catch (error) {
            console.error('Error loading file:', error);
        }
    });

    // Function to load menu data
    function loadMenuData() {
        const savedData = localStorage.getItem('menuData');
        if (savedData) {
            menuData = JSON.parse(savedData);
            renderMenu();
        } else {
            $.ajax({
                url: 'menu.json',
                dataType: 'json',
                success: function(data) {
                    menuData.links = data.links;
                    renderMenu();
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error('Error loading menu data:', textStatus, errorThrown);
                }
            });
        }
    }

    // Function to trigger the Git action
    function triggerGitAction() {
        $.ajax({
            url: '/api/git-action',
            type: 'POST',
            success: function() {
                console.log('Git action triggered');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering Git action:', textStatus, errorThrown);
            }
        });
    }

    // Initial load
    loadMenuData();
    renderCalendar(currentMonth, currentYear);
    triggerGitAction();
});
