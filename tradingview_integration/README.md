# TradingView Integration Project

This project demonstrates how to integrate TradingView's Pine Script with Google Apps Script, using GitHub as a database for data storage.

## Project Structure

- **/pine_script**: Contains the Pine Script files.
- **/google_apps_script**: Contains the Google Apps Script files.
- **/data**: Contains the data files, both in `.csv` and compressed `.dat` format.
- **/.github/workflows**: Contains the GitHub Actions workflow file.

## How it works

1.  **Data is stored in a `.csv` file** in the `/data` directory.
2.  **A Google Apps Script** reads the `.csv` file, compresses it into a `.dat` file (using gzip), and pushes it to this GitHub repository using the GitHub API. This script can be triggered manually or on a schedule.
3.  **A Pine Script indicator** on TradingView uses the `request.seed()` function to read the `.dat` file directly from the GitHub repository. This allows the indicator to use external data that is updated dynamically.
4.  **A GitHub Actions workflow** is set up to automate tasks, such as running the Google Apps Script on a schedule.

## Setup

1.  **Create a GitHub Personal Access Token (PAT)** with the `repo` scope.
2.  **In your Google Apps Script project, go to "Project Settings" > "Script Properties"** and add a new property with the key `GITHUB_TOKEN` and the value as your PAT. **Do not hardcode your PAT in the script.**
3.  **Deploy your Google Apps Script as a Web App.**
4.  **Set up a GitHub Actions workflow** to trigger the web app URL on a schedule.

This setup allows for a powerful and flexible way to get external data into your TradingView indicators, with the data being managed and updated through a combination of Google Apps Script and GitHub Actions.
