// worker.js
// Import Pako into the worker thread via CDN
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');

let lastGeneratedAt = 0;

// Poll every 60 seconds
setInterval(async () => {
  try {
    // Cache bust with timestamp
    const res = await fetch(`dbs/performer_images_manifest.dat?t=${Date.now()}`);
    if (!res.ok) return;

    const compressed = await res.arrayBuffer();
    const decompressed = pako.inflate(new Uint8Array(compressed), { to: 'string' });
    const data = JSON.parse(decompressed);

    // Only send data back to the main thread if it's genuinely new
    if (data.generated_at > lastGeneratedAt) {
      lastGeneratedAt = data.generated_at;
      
      // Post the parsed array back to the main UI thread
      postMessage({ 
        type: 'DATA_UPDATE', 
        items: data.items,
        totalCount: data.performer_count
      });
    }
  } catch (error) {
    console.error('Worker encountered an error:', error);
  }
}, 60000); 
