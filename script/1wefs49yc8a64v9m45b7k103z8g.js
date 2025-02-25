// Function to toggle the mobile menu
function toggleMobileMenu() {
    var x = document.getElementById("mobile-menu");
    if (x.className.indexOf("w3-show") == -1) {
        x.className += " w3-show";
    } else {
        x.className = x.className.replace(" w3-show", "");
    }
}

// Moved tickers array to tickers.js.

function createMenuLinks(tickers, containerId, isMobile = false) {
    const menuContainer = document.getElementById(containerId);
    if (!menuContainer) {
        console.error(`Menu container with ID '${containerId}' not found.`);
        return;
    }
    tickers.forEach(ticker => {
        const link = document.createElement('a');
        link.href = `./${ticker}/index.html`;
        link.textContent = ticker.toUpperCase();
        // Apply w3.css classes for styling and responsiveness
        link.classList.add('w3-bar-item', 'w3-button', 'w3-padding-small', 'w3-hover-light-grey');
        if (isMobile) {
            link.classList.add('w3-large'); //Larger mobile.
        }
        menuContainer.appendChild(link);
    });
}

// Create links for the main menu (desktop)
createMenuLinks(tickers, 'menu-links');

//Create menu links for the mobile.
createMenuLinks(tickers, 'mobile-menu', true);

