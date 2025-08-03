import json

def add_new_link():
    """
    This function adds a new link to the menu.json file.
    """
    with open('menu/menu.json', 'r+') as f:
        data = json.load(f)
        data['links'].append({
            "text": "New Link",
            "url": "https://www.newlink.com"
        })
        f.seek(0)
        json.dump(data, f, indent=4)
        f.truncate()

if __name__ == "__main__":
    add_new_link()
