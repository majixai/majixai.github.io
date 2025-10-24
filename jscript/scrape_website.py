import requests
from bs4 import BeautifulSoup

def scrape_website(url):
    """
    Scrapes the given URL and prints the title and all the paragraphs.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes

        soup = BeautifulSoup(response.content, "html.parser")

        # Extract the title
        title = soup.title.string
        print(f"Title: {title}")

        # Extract all paragraphs
        paragraphs = soup.find_all("p")
        for i, p in enumerate(paragraphs):
            print(f"Paragraph {i+1}: {p.get_text()}")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching the URL: {e}")

if __name__ == "__main__":
    url_to_scrape = "https://majixai.github.io/scrape/index.html"
    scrape_website(url_to_scrape)
