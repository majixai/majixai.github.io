import asyncio

clients = {}

async def handle_client(reader, writer):
    addr = writer.get_extra_info('peername')
    print(f"New connection from {addr}")

    writer.write("Please enter your username: ".encode())
    await writer.drain()
    username_data = await reader.read(100)
    username = username_data.decode().strip()

    while username in clients.values():
        writer.write(f"Username '{username}' is already taken. Please choose another: ".encode())
        await writer.drain()
        username_data = await reader.read(100)
        username = username_data.decode().strip()

    clients[writer] = username
    print(f"{username} has joined the chat.")

    for client_writer in clients:
        if client_writer != writer:
            client_writer.write(f"{username} has joined the chat!\n".encode())
            await client_writer.drain()

    try:
        while True:
            data = await reader.read(100)
            if not data:
                break
            message = data.decode().strip()
            print(f"Received message from {username}: {message}")

            for client_writer in clients:
                if client_writer != writer:
                    client_writer.write(f"{username}: {message}\n".encode())
                    await client_writer.drain()
    except asyncio.CancelledError:
        pass
    finally:
        del clients[writer]
        print(f"{username} has left the chat.")
        for client_writer in clients:
            client_writer.write(f"{username} has left the chat.\n".encode())
            await client_writer.drain()
        writer.close()
        await writer.wait_closed()

async def main():
    server = await asyncio.start_server(
        handle_client, '127.0.0.1', 8888)

    addr = server.sockets[0].getsockname()
    print(f'Serving on {addr}')

    async with server:
        await server.serve_forever()

if __name__ == '__main__':
    asyncio.run(main())
