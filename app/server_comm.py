import asyncio
import requests


async def notify_other_server_async(url, payload=None):
    """Async wrapper — runs the blocking HTTP POST in a thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, notify_other_server, url, payload)


def notify_other_server(url, payload=None):
    try:
        resp = requests.post(url, json=payload or {})
        return resp.json()
    except Exception as e:
        return {'error': str(e)}
