(function() {
    const LOGGING_SERVICE_URL = 'https://script.google.com/macros/s/AKfycbzr5jBpyz_6w94lOZotEoYpVa9kDY603A_6QAB4FLRSnI5GDlgzfRb8FOCR8uTdoGGc/exec';

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function logClick(targetUrl) {
        const data = {
            timestamp: new Date().toISOString(),
            target: targetUrl,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
        };

        // We use navigator.sendBeacon if available for more reliable background sending
        if (navigator.sendBeacon) {
            navigator.sendBeacon(LOGGING_SERVICE_URL, JSON.stringify(data));
        } else {
            // Fallback to fetch for older browsers
            fetch(LOGGING_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                keepalive: true // keepalive helps ensure the request is sent even if the page is redirecting
            }).catch(error => console.error('Error logging click:', error));
        }
    }

    const targetUrl = getQueryParam('url');

    if (targetUrl) {
        logClick(targetUrl);
        // Redirect to the target URL after a short delay to ensure the beacon is sent
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 100); // 100ms delay
    } else {
        console.error('No target URL found for redirection.');
        // Optionally, redirect to a default page or show an error
        document.body.innerHTML = '<p>Error: No destination URL specified.</p>';
    }
})();