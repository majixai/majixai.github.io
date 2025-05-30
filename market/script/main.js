import { market } from './Market.js';

$(document).ready(function(){
    const menuBar = new MenuBar('menu-bar-container');

    // File Menu
    const fileMenu = new MenuGroup('File');
    fileMenu.addItem(new MenuItem('Open', () => console.log('Open action triggered')));
    fileMenu.addItem(new MenuItem('Save', () => console.log('Save action triggered')));
    fileMenu.addItem(new MenuItem('Export CSV', () => {
        console.log('Export CSV action triggered - placeholder');
        alert('Export CSV functionality is not yet implemented. Depends on ticker data source.');
    }));
    menuBar.addGroup(fileMenu);

    // View Menu
    const viewMenu = new MenuGroup('View');
    viewMenu.addItem(new MenuItem('Market Data', () => console.log('View Market Data action')));
    viewMenu.addItem(new MenuItem('Charts', () => console.log('View Charts action')));
    
    const dataSubMenu = new MenuGroup('Data Options');
    dataSubMenu.addItem(new MenuItem('Option A', () => console.log('Option A')));
    dataSubMenu.addItem(new MenuItem('Option B', () => console.log('Option B')));
    viewMenu.addItem(dataSubMenu); // Adding a submenu

    menuBar.addGroup(viewMenu);

    // Tools Menu
    const toolsMenu = new MenuGroup('Tools');
    toolsMenu.addItem(new MenuItem('Settings', () => console.log('Settings action triggered')));
    menuBar.addGroup(toolsMenu);

    menuBar.render();

    // Existing code
    $('#fetch-data-button').click(() => market.fetchMarketData());
    
    // Fetch data and update chart every 60 seconds
    market.fetchDataAndUpdateChart();
    setInterval(() => market.fetchDataAndUpdateChart(), 60000);
});
