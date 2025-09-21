import requests
from bs4 import BeautifulSoup

def scrape_craigslist_jobs(city="sfbay"):
    """
    Scrapes job postings from a specific city on Craigslist using requests and BeautifulSoup.

    :param city: The city to search for jobs in (e.g., "sfbay" for San Francisco Bay Area).
    """
    print(f"Scraping Craigslist jobs in {city}...")

    # Navigate to the Craigslist jobs page
    url = f"https://{city}.craigslist.org/d/software-qa-dba-etc/search/sof"
    response = requests.get(url)

    if response.status_code != 200:
        print(f"Failed to retrieve the page. Status code: {response.status_code}")
        return

    soup = BeautifulSoup(response.content, "html.parser")

    # Find all the job postings
    jobs = soup.find_all("li", class_="cl-static-search-result")
    print(f"Found {len(jobs)} jobs.")

    # Extract and print the job details
    for job in jobs:
        title_element = job.find("div", class_="title")
        title = title_element.text.strip() if title_element else "N/A"

        link_element = job.find("a")
        url = link_element["href"] if link_element else "N/A"

        print(f"Title: {title}")
        print(f"URL: {url}")
        print("-" * 20)

if __name__ == "__main__":
    scrape_craigslist_jobs()
