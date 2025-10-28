import subprocess
import asyncio
import os

LOG_FILE = 'chat_server.log'
SERVER_FILE = 'chat_server/server.py'
HOST = '127.0.0.1'
PORT = 8888


async def run_test():
    # 1. Clean up previous log file if it exists
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    # 2. Start the server as a subprocess
    print("Starting server...")
    server_process = subprocess.Popen(['python', SERVER_FILE])

    # Give the server a moment to start up
    await asyncio.sleep(1)

    try:
        # 3. Simulate a client connection
        print("Connecting client...")
        reader, writer = await asyncio.open_connection(HOST, PORT)

        # The server expects a username, so we send one
        await reader.read(1024)  # Read the "Please enter your username" prompt
        writer.write(b'test_user\n')
        await writer.drain()

        # Give a moment for the server to process the connection and log it
        await asyncio.sleep(1)

        print("Closing client connection...")
        writer.close()
        await writer.wait_closed()
        print("Client disconnected.")

    finally:
        # 4. Stop the server
        print("Terminating server...")
        server_process.terminate()
        await asyncio.to_thread(server_process.wait)
        print("Server terminated.")

    # 5. Verify the log file
    print(f"Checking log file: {LOG_FILE}")
    if not os.path.exists(LOG_FILE):
        print("Error: Log file was not created.")
        return False

    with open(LOG_FILE, 'r') as f:
        log_content = f.read()

    if "New connection from" in log_content:
        print("Success: Connection event was logged successfully.")
        return True
    else:
        print("Failure: Connection event was not found in the log.")
        print("--- Log Content ---")
        print(log_content)
        print("-------------------")
        return False

if __name__ == "__main__":
    test_passed = asyncio.run(run_test())
    if not test_passed:
        # Exit with a non-zero code to fail CI
        exit(1)
    else:
        # Clean up log file on success
        if os.path.exists(LOG_FILE):
            os.remove(LOG_FILE)
