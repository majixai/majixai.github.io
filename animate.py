import json


def animate_menu():
    with open('json/menu.json', 'r') as f:
        menu_data = json.load(f)

    for link in menu_data['links']:
        link['text'] = f"✨ {link['text']} ✨"

    with open('json/menu.json', 'w') as f:
        json.dump(menu_data, f, indent=4)

if __name__ == '__main__':
    animate_menu()
