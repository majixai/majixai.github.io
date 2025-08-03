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
        $('#link-to-edit').empty();

        const groupedLinks = {
            "check-in-online": [],
            "check-in-chat": [],
            "investing": []
        };

        menuData.links.forEach(link => {
            if (link.type === "check-in-online") {
                groupedLinks["check-in-online"].push(link);
            } else if (link.type === "check-in-chat") {
                groupedLinks["check-in-chat"].push(link);
            } else if (link.type === "investing") {
                groupedLinks["investing"].push(link);
            }
        });

        for (const group in groupedLinks) {
            if (groupedLinks[group].length > 0) {
                const header = $('<h3></h3>').text(group.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                menuList.append(header);
                groupedLinks[group].forEach((linkData, index) => {
                    const link = $('<a></a>').attr('href', linkData.url).attr('target', '_blank').text(linkData.text);
                    const counter = $('<span></span>').addClass('click-counter').text(menuData.clickCounts[linkData.url] || 0);
                    const listItem = $('<li></li>').append(link).append(counter);
                    menuList.append(listItem);

                    $('#link-to-edit').append($('<option>', {
                        value: menuData.links.indexOf(linkData),
                        text: linkData.text
                    }));

                    link.on('click', (e) => {
                        e.preventDefault();
                const url = linkData.url;
                $.ajax({
                    url: '/api/links/click',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ url }),
                    success: function() {
                        $.getJSON('menu/clicks.json', function(data) {
                            counter.text(data[url] || 0);
                        });
                    }
                });
                $('#link-iframe').attr('src', url);
                    });
                });
            }
        }
    }

    $('#edit-link-btn').on('click', () => {
        const index = $('#link-to-edit').val();
        const newText = $('#new-link-text').val();
        const newUrl = $('#new-link-url').val();

        if (newText) {
            menuData.links[index].text = newText;
        }
        if (newUrl) {
            menuData.links[index].url = newUrl;
        }

        localStorage.setItem('menuData', JSON.stringify(menuData));
        renderMenu();
        $('#new-link-text').val('');
        $('#new-link-url').val('');
    });

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

    // Actions
    $('#python-action-btn').on('click', () => {
        $.ajax({
            url: '/api/python-action',
            type: 'POST',
            success: function(response) {
                console.log(response.message);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering Python action:', textStatus, errorThrown);
            }
        });
    });

    $('#genai-action-btn').on('click', () => {
        const prompt = 'Hello, GenAI!';
        $.ajax({
            url: '/api/genai-action',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ prompt }),
            success: function(response) {
                console.log(response.generated_text);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering GenAI action:', textStatus, errorThrown);
            }
        });
    });

    $('#data-storage-action-btn').on('click', () => {
        const newLink = {
            text: 'New Link from Action',
            url: 'https://www.newlinkfromaction.com'
        };
        $.ajax({
            url: '/api/data-storage-action',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(newLink),
            success: function() {
                loadMenuData();
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering Data Storage action:', textStatus, errorThrown);
            }
        });
    });

    // GenAI Actions
    $('#summarize-btn').on('click', () => {
        const text = "Paris is the capital and most populous city of France, with an estimated population of 2,148,271 residents as of 2020, in an area of 105 square kilometres (41 square miles). Since the 17th century, Paris has been one of Europe's major centres of finance, diplomacy, commerce, fashion, science and arts. The City of Paris is the centre and seat of government of the Île-de-France, or Paris Region, which has an estimated official 2020 population of 12,278,210, or about 18 percent of the population of France.";
        $.ajax({
            url: '/api/summarize',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ text }),
            success: function(response) {
                console.log(response.summary);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering Summarize action:', textStatus, errorThrown);
            }
        });
    });

    $('#translate-btn').on('click', () => {
        const text = "Hello, world!";
        $.ajax({
            url: '/api/translate',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ text }),
            success: function(response) {
                console.log(response.translation);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering Translate action:', textStatus, errorThrown);
            }
        });
    });

    $('#qa-btn').on('click', () => {
        const question = "What is the capital of France?";
        const context = "Paris is the capital and most populous city of France.";
        $.ajax({
            url: '/api/qa',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ question, context }),
            success: function(response) {
                console.log(response.answer);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error triggering Q&A action:', textStatus, errorThrown);
            }
        });
    });

    // Initial load
    loadMenuData();
    triggerGitAction();
});
