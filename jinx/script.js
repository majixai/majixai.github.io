// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

// Function to show the alert
function showAlert() {
  alert('15-Minute Alert!');
}

// Set up the interval (15 minutes = 900000 milliseconds)
setInterval(showAlert, 900000);
