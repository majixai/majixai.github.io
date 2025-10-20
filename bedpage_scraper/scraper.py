import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

def scrape_bedpage(url):
    """
    Scrapes post information from a given bedpage URL.

    :param url: The URL of the bedpage category to scrape.
    """
    # Set up Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in headless mode
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    # Set up the Chrome driver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        # Navigate to the URL
        driver.get(url)

        # Wait for the page to load (adjust the sleep time if necessary)
        time.sleep(10)

        # Find all the post listings
        posts = driver.find_elements(By.CSS_SELECTOR, 'div.listbox')

        print(f"Found {len(posts)} posts.")

        # Extract and print the details of each post
        for post in posts:
            title_element = post.find_element(By.CSS_SELECTOR, 'a.first')
            title = title_element.text.strip()
            link = title_element.get_attribute('href')

            print(f"Title: {title}")
            print(f"Link: {link}")
            print("-" * 20)

    finally:
        # Close the driver
        driver.quit()

if __name__ == "__main__":
    target_url = "https://lasvegas.bedpage.com/Escorts/"
    scrape_bedpage(target_url)