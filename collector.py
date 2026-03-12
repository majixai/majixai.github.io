import asyncio
import aiohttp
import sqlite3
import json
import zlib
import time
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BASE_API_URL", "https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A")
LIMIT = 500
PAGES = 20           # 20 * 500 = 10,000 users
FETCH_WINDOW = 60    # Run for 1 minute
INTERVAL = 10        # Trigger deep sweep every 10 seconds
DB_NAME = "data_store.dat"

async def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS captures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            age INTEGER,
            tags TEXT,
            timestamp DATETIME,
            metadata TEXT,
            image_blob BLOB
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user ON captures(username)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_time ON captures(timestamp)')
    conn.commit()
    return conn

async def store_room(db_conn, session, room, timestamp):
    username = room.get('username')
    image_url = room.get('image_url')
    
    img_data = b""
    if image_url:
        try:
            async with session.get(image_url, timeout=3) as img_resp:
                if img_resp.status == 200:
                    # Compress binary image data to save disk space
                    img_data = zlib.compress(await img_resp.read(), level=9)
        except:
            pass 

    cursor = db_conn.cursor()
    cursor.execute('''
        INSERT INTO captures (username, age, tags, timestamp, metadata, image_blob)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        username,
        room.get('age'),
        json.dumps(room.get('tags', [])),
        timestamp,
        json.dumps(room),
        img_data
    ))

async def deep_fetch_sweep(session, db_conn):
    """Fetches all 10,000 items using 20 paginated requests."""
    sweep_timestamp = datetime.now().isoformat()
    all_rooms = []
    
    # 1. Fetch all metadata pages
    for page in range(PAGES):
        offset = page * LIMIT
        url = f"{BASE_URL}&limit={LIMIT}&offset={offset}"
        try:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    all_rooms.extend(data.get('results', []))
        except Exception as e:
            print(f"Error fetching page {page}: {e}")

    # 2. Process and store everything (including image fetching/compression)
    if all_rooms:
        tasks = [store_room(db_conn, session, room, sweep_timestamp) for room in all_rooms]
        # Chunking tasks to avoid overwhelming local network/memory
        for i in range(0, len(tasks), 100):
            await asyncio.gather(*tasks[i:i+100])
        
        db_conn.commit()
        print(f"[{sweep_timestamp}] Deep Sweep Complete: {len(all_rooms)} records stored.")

async def main():
    db_conn = await init_db()
    start_time = time.time()
    
    async with aiohttp.ClientSession() as session:
        # Loop for exactly 1 minute
        while time.time() - start_time < FETCH_WINDOW:
            loop_start = time.time()
            
            # Start the deep sweep
            await deep_fetch_sweep(session, db_conn)
            
            # Calculate sleep to hit the next 10-second mark
            elapsed = time.time() - loop_start
            wait_time = max(0, INTERVAL - (time.time() - loop_start))
            if time.time() - start_time + wait_time < FETCH_WINDOW:
                await asyncio.sleep(wait_time)
            else:
                break

    db_conn.close()

if __name__ == "__main__":
    asyncio.run(main())

