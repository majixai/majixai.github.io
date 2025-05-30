// market/script/menuSystem.js

/**
 * Represents a single clickable menu item.
 */
class MenuItem {
  /**
   * @param {string} label The text to display for the menu item.
   * @param {function} action The function to execute when the item is clicked.
   */
  constructor(label, action) {
    this.label = label;
    this.action = action;
  }

  /**
   * Creates the HTML element for this menu item.
   * @returns {HTMLElement} The list item element.
   */
  render() {
    const listItem = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#'; // Prevent page navigation
    link.textContent = this.label;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.action) {
        this.action();
      }
    });
    listItem.appendChild(link);
    return listItem;
  }
}

/**
 * Represents a group of menu items, which can include other MenuGroups (for submenus).
 */
class MenuGroup {
  /**
   * @param {string} label The text to display for the menu group (e.g., "File").
   */
  constructor(label) {
    this.label = label;
    this.items = []; // Array of MenuItem or MenuGroup instances
  }

  /**
   * Adds an item (MenuItem or MenuGroup) to this group.
   * @param {MenuItem|MenuGroup} item The item to add.
   */
  addItem(item) {
    this.items.push(item);
  }

  /**
   * Creates the HTML element for this menu group (typically a dropdown).
   * @returns {HTMLElement} The list item element representing the group.
   */
  render() {
    const groupElement = document.createElement('li');
    groupElement.classList.add('menu-group');

    const titleLink = document.createElement('a');
    titleLink.href = '#';
    titleLink.textContent = this.label;
    groupElement.appendChild(titleLink);

    if (this.items.length > 0) {
      const submenu = document.createElement('ul');
      submenu.classList.add('submenu');
      this.items.forEach(item => {
        submenu.appendChild(item.render());
      });
      groupElement.appendChild(submenu);
    }
    return groupElement;
  }
}

/**
 * Manages the overall menu bar and its rendering.
 */
class MenuBar {
  /**
   * @param {string} containerId The ID of the HTML element where the menu bar should be rendered.
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.menuGroups = []; // Array of MenuGroup instances
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`MenuBar: Container element with ID '${containerId}' not found.`);
    }
  }

  /**
   * Adds a top-level menu group to the menu bar.
   * @param {MenuGroup} menuGroup The MenuGroup to add.
   */
  addGroup(menuGroup) {
    this.menuGroups.push(menuGroup);
  }

  /**
   * Renders the entire menu bar into the specified container.
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = ''; // Clear previous content
    const menuList = document.createElement('ul');
    menuList.classList.add('menu-bar-list');

    this.menuGroups.forEach(group => {
      menuList.appendChild(group.render());
    });

    this.container.appendChild(menuList);
    this.addEventListeners(); // Add event listeners for dropdown behavior
  }

  /**
   * Adds event listeners for basic dropdown functionality.
   * This is a simple implementation for demonstration.
   */
  addEventListeners() {
    const menuGroups = this.container.querySelectorAll('.menu-group > a');
    menuGroups.forEach(titleLink => {
      titleLink.addEventListener('click', (e) => {
        e.preventDefault();
        const parentLi = titleLink.parentElement;
        const submenu = parentLi.querySelector('.submenu');
        if (submenu) {
          // Toggle 'open' class on the parent li to control visibility via CSS
          parentLi.classList.toggle('open');
        }
      });
    });

    // Optional: Close submenus when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.container.querySelectorAll('.menu-group.open').forEach(group => {
          group.classList.remove('open');
        });
      }
    });
  }
}

// Export classes if using modules (optional, depending on how it's included)
// Example: export { MenuItem, MenuGroup, MenuBar };
// For direct script inclusion, they are available globally or within script scope.
