import requests

def notify_other_server(url, payload=None):
    try:
        resp = requests.post(url, json=payload or {})
        return resp.json()
    except Exception as e:
        return {'error': str(e)}
