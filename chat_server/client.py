import asyncio

async def receive_messages(reader):
    while True:
        data = await reader.read(1024)
        if not data:
            print("Connection closed by server.")
            break
        print(data.decode(), end="")

async def main():
    reader, writer = await asyncio.open_connection('127.0.0.1', 8888)

    # Start a task to receive messages from the server
    receive_task = asyncio.create_task(receive_messages(reader))

    # Read the initial username prompt
    initial_prompt = await reader.read(1024)
    print(initial_prompt.decode(), end="")

    # Send username
    username = await asyncio.to_thread(input)
    writer.write(username.encode())
    await writer.drain()

    # Handle subsequent prompts if username is taken
    while True:
        response_bytes = await reader.read(1024)
        response = response_bytes.decode()
        if "Username" in response and "is already taken" in response:
            print(response, end="")
            new_username = await asyncio.to_thread(input)
            writer.write(new_username.encode())
            await writer.drain()
        else:
            # If the response is not a username prompt, print it and break
            print(response, end="")
            break

    # Main loop to send messages
    try:
        while True:
            message = await asyncio.to_thread(input)
            if message.lower() == 'exit':
                break
            writer.write(message.encode())
            await writer.drain()
    finally:
        receive_task.cancel()
        writer.close()
        await writer.wait_closed()
        print("Disconnected from server.")

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nClient shutting down.")
