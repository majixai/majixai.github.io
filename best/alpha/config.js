// --- Configuration ---
// !! IMPORTANT !! Replace this with the actual URL of your server-side endpoint
// Make sure this endpoint is accessible from where this script runs (CORS headers might be needed on the server)
// Example: const REPORT_SERVER_ENDPOINT = 'https://yourserver.com/api/send-user-report';
const REPORT_SERVER_ENDPOINT = '/api/send-user-report'; // Placeholder URL - NEEDS REPLACEMENT

// --- API Configuration ---
// !! Verify this URL is correct and accessible from where your page is hosted !!
const apiUrlBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?tour=dU9X&wm=9cg6A&disable_sound=1&client_ip=request_ip&gender=f';
const apiLimit = 500; // Limit per API page request
const fetchIntervalDuration = 120000; // 2 minutes (120 * 1000 milliseconds)
const maxHistorySize = 100; // Max number of users to keep in the 'previousUsers' history
const apiFetchTimeout = 25000; // Timeout for each API fetch request (milliseconds)
const reportSendTimeout = 45000; // Timeout for sending the report (milliseconds)
const maxApiFetchLimit = 20000; // Safety limit for total users fetched in one cycle
