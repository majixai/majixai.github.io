$(document).ready(() => {
    const menuList = $('#menu-list');
    const addLinkContainer = $('#add-link-container');
    const calendarModal = $('#calendar-modal');

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
            });
        });
    }

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

    // Function to run the python animation script
    function runAnimation() {
        $.ajax({
            url: 'animate.py',
            type: 'GET',
            success: function() {
                loadMenuData('json/menu.json');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error running animation script:', textStatus, errorThrown);
            }
        });
    }

    // Add animation button
    const animateBtn = $('<button>Animate</button>');
    animateBtn.on('click', runAnimation);
    $('body').append(animateBtn);

    // Initial load
    loadMenuData('json/menu.json');
});
