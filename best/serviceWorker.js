self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

async function fetchData() {
    const limit = 500;
    let offset = 0;
    let continueFetching = true;
    let allOnlineUsersData = [];

    while (continueFetching) {
        const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=${limit}&offset=${offset}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                allOnlineUsersData = allOnlineUsersData.concat(data.results);
                if (data.results.length < limit) {
                    continueFetching = false;
                } else {
                    offset += limit;
                }
            } else {
                continueFetching = false;
            }
        } catch (error) {
            console.error("Fetch error:", error);
            return { error: error.message };
        }
    }

    return { data: allOnlineUsersData };
}

self.addEventListener('message', async event => {
    if (event.data && event.data.type === 'FETCH_USERS') {
        const result = await fetchData();
        event.ports[0].postMessage(result);
    }
});
