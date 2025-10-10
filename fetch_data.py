import requests
import json

def fetch_and_save_properties():
    """Fetches property data from the API and saves it to a JSON file."""
    url = "http://127.0.0.1:5001/api/properties"
    output_path = "reit_company_static/static/properties.json"

    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes

        data = response.json()

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=4)

        print(f"Successfully saved property data to {output_path}")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    fetch_and_save_properties()