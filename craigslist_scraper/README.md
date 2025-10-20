# Craigslist Job Scraper

This script scrapes job postings from the software/qa/dba section of Craigslist for a specified city.

## Setup

1.  **Clone the repository or download the files.**
2.  **Navigate to the `craigslist_scraper` directory:**
    ```bash
    cd craigslist_scraper
    ```
3.  **Install the required dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

## How to Run

To run the scraper, execute the following command in your terminal from within the `craigslist_scraper` directory:

```bash
python scraper.py
```

By default, it scrapes jobs from the San Francisco Bay Area (`sfbay`). You can modify the `city` parameter in the `scrape_craigslist_jobs()` function call at the bottom of `scraper.py` to scrape other cities.

## Example Output

The script will print the scraped job postings to the console, like this:

```
Scraping Craigslist jobs in sfbay...
Found 8 jobs.
Title: Web Designer/Developer Auction Website Design Start Today
URL: https://sfbay.craigslist.org/scz/sof/d/menlo-park-web-designer-developer/7882577438.html
--------------------
Title: Koi Pond Maintenance Technician apprentice
URL: https://sfbay.craigslist.org/sby/sof/d/san-jose-koi-pond-maintenance/7881252202.html
--------------------
...
```
