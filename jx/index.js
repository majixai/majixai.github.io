// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => console.log('Service Worker registered:', registration))
      .catch(error => console.error('Service Worker registration failed:', error));
  });
}

const enableNotificationsButton = document.getElementById('enableNotifications');
const notificationStatus = document.getElementById('notificationStatus');
let notificationInterval;

function showNotification() {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Periodic Alert', {
        body: 'This is your periodic reminder!',
        icon: '/icon-192x192.png',
        vibrate: [200, 100, 200] // Optional: Vibration pattern
      });
    });
  } else if (Notification.permission !== 'denied') {
    notificationStatus.textContent = 'Notifications are disabled.';
  }
}

function startNotificationInterval() {
  notificationInterval = setInterval(showNotification, 20 * 1000); // Every 5 minutes (adjust to 15 * 60 * 1000 for 15 minutes)
  notificationStatus.textContent = 'Notifications enabled and will appear periodically.';
  enableNotificationsButton.disabled = false;
}

enableNotificationsButton.addEventListener('click', () => {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      startNotificationInterval();
    } else {
      console.log('Notification permission denied.');
      notificationStatus.textContent = 'You have denied notification permissions.';
    }
  });
});

// Check if permission is already granted on page load
window.addEventListener('load', () => {
  if (Notification.permission === 'granted') {
    startNotificationInterval();
  } else if (Notification.permission === 'denied') {
    notificationStatus.textContent = 'You have previously denied notification permissions.';
    enableNotificationsButton.style.display = 'none'; // Optionally hide the button
  }
});
