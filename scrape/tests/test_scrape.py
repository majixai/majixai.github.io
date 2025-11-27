import os
import re
from playwright.sync_api import Page, expect

def test_scrape_engine(page: Page):
    # Capture console logs
    page.on('console', lambda msg: print(f'CONSOLE: {msg.text}'))

    # Navigate to the local server
    page.goto('http://localhost:8000/scrape/index.html')

    # Check for the main title
    expect(page.locator('h1')).to_have_text('Scraped Financial Data')

    # Wait for the loader to disappear, indicating that the data has been loaded
    expect(page.locator('#loader')).to_be_hidden(timeout=10000)

    # Check for the summary statistics section
    summary_section = page.locator('div.w3-card-4').first
    expect(summary_section).to_be_visible()

    # Check for the total tickers, allowing for some variability in the exact number
    total_tickers_text = summary_section.locator('p', has_text='Total Tickers:')
    expect(total_tickers_text).to_contain_text(re.compile(r'Total Tickers: \d+'))

    # Check for a valid timestamp in the "Most Recent Update"
    # This regex is flexible enough to handle different date/time formats
    update_text = summary_section.locator('p', has_text='Most Recent Update:')
    expect(update_text).to_contain_text(re.compile(r'Most Recent Update: \d{1,2}/\d{1,2}/\d{4}'))

        # Check that the average price is a valid dollar amount
    average_price_text = summary_section.locator('p', has_text='Average Price:')
    expect(average_price_text).to_contain_text(re.compile(r'Average Price: \$\d+\.\d{2}'))

    # Check for the ticker list section
    ticker_list_section = page.locator('div.w3-card-4 h2', has_text='Ticker List').last
    expect(ticker_list_section).to_be_visible()

    # Check for the search input
    search_input = page.locator('input#search-input')
    expect(search_input).to_be_visible()
    expect(search_input).to_have_attribute('placeholder', 'Search by ticker or name...')

    # Check for the table headers
    table = page.locator('table.w3-table-all')
    expect(table).to_be_visible()
    headers = table.locator('th')
    expect(headers).to_have_text(['Ticker', 'Name', 'Price', 'Scraped At'])

    # Check for at least one row of data in the table
    first_row = table.locator('tbody tr').first
    expect(first_row).to_be_visible()

    # Test the filter functionality
    search_input.type('GOOG')

    # After filtering, expect only rows containing 'GOOG' to be visible
    rows = table.locator('tbody tr')
    for i in range(rows.count()):
        row = rows.nth(i)
        expect(row.locator('td').first).to_contain_text('GOOG')

    # Take a screenshot for verification
    page.screenshot(path="scrape_engine.png")
