# Simple Calculator with GAS Webhook

A simple web application that generates two random numbers, calculates their sum, and logs the calculation to a Google Sheet via a webhook before displaying the result.

## Features

- **Random Number Generation**: Generates two random numbers between 1-100
- **Immediate Webhook Call**: Sends calculation data to Google Apps Script as soon as numbers are generated
- **Delayed Result Display**: Shows the result 1 second after the calculation is sent to ensure data is logged first
- **Google Sheets Integration**: All calculations are automatically logged to a spreadsheet

## How It Works

1. User clicks "Generate & Calculate"
2. Two random numbers are generated and displayed immediately
3. The calculation (numbers + result) is sent to the GAS webhook
4. The webhook logs the data to a Google Sheet
5. After 1 second delay, the result is displayed in the web app

This ensures that the calculation is recorded in Google Sheets **before** the result is shown to the user.

## Files

| File | Description |
|------|-------------|
| `index.html` | The main web application (hosted on GitHub Pages) |
| `Code.gs` | Google Apps Script code for the webhook handler |
| `appsscript.json` | Apps Script manifest configuration |
| `gas_index.html` | Documentation page served by the GAS web app |

## Setup

### 1. Deploy the GAS Webhook

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Go to **Extensions > Apps Script**
3. Delete any existing code and paste the contents of `Code.gs`
4. Create a new HTML file named `index` and paste the contents of `gas_index.html`
5. Open Project Settings (gear icon) and check "Show 'appsscript.json' manifest file"
6. Replace the contents of `appsscript.json` with the provided file (update timezone if needed)
7. Click **Deploy > New deployment**
8. Choose **Web app** as the type
9. Set:
   - **Execute as**: Me
   - **Who has access**: Anyone
10. Click **Deploy** and authorize when prompted
11. Copy the deployment URL

### 2. Configure the Web App

1. Open `index.html` in your browser (or visit the GitHub Pages URL)
2. Paste the GAS deployment URL into the "GAS Webhook URL" field
3. Click "Generate & Calculate"
4. Check your Google Sheet - the calculation should appear in the "Calculations" tab

## API Reference

### Webhook Endpoint

**POST** `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`

#### Request Body

```json
{
  "num1": 42,
  "num2": 58,
  "operation": "addition",
  "result": 100,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "simple_calculator"
}
```

#### Response

```json
{
  "success": true,
  "message": "Calculation logged successfully",
  "row": 5,
  "timestamp": "2024-01-15T10:30:01.000Z"
}
```

## Data Logged to Sheet

The following columns are created in the "Calculations" sheet:

| Column | Description |
|--------|-------------|
| Timestamp | Server-side timestamp when data was received |
| Number 1 | First random number |
| Number 2 | Second random number |
| Operation | Type of calculation (addition) |
| Result | Calculated result |
| Source | Source application identifier |
| Client Timestamp | Timestamp from the client |

## Browser Compatibility

The web app uses modern JavaScript features and should work in all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

Note: Due to CORS restrictions, the webhook uses `no-cors` mode which means error details from failed requests are not available in the browser.

## License

This project is part of the majixai.github.io repository.
