# Company Data Tracker

This directory is used to store and manage data for various companies. The data is organized by company name, with each company having its own set of subdirectories for different types of information.

## Directory Structure

The data is organized as follows:

- `company_data/`
  - `ledgers/`: Contains ledger information for each company, typically in CSV format.
    - `[company_name]/`
      - `ledger.csv`
  - `notes/`: Contains daily notes for each company. Each note is a text file named with the date (YYYY-MM-DD).
    - `[company_name]/`
      - `YYYY-MM-DD.txt`
  - `reminders/`: Contains reminders for each company.
    - `[company_name]/`
      - `reminders.txt`
  - `calendar/`: Contains calendar events for each company, typically in JSON format.
    - `[company_name]/`
      - `events.json`
  - `contacts/`: Contains contact information for each company, typically in JSON format.
    - `[company_name]/`
      - `contacts.json`

## Usage

To add data for a new company, create a new directory with the company's name in each of the subdirectories (`ledgers`, `notes`, `reminders`, `calendar`, `contacts`). Then, add the relevant data files to those directories.
