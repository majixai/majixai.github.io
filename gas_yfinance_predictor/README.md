# YFinance Predictor with GenAI & Git Webhook

A comprehensive Google Apps Script (GAS) application that fetches yfinance data, generates AI-powered price predictions, and integrates with Git webhooks for automated updates. Features compressed database storage via Google Drive for optimized performance.

## 🚀 Features

- **Git Webhook Integration**: Automatically refresh data when code changes are pushed
- **YFinance Data Fetching**: Real-time market data from any directory
- **GenAI Price Predictions**: AI-powered predictions for indices and user-specified tickers
- **Interactive Sidebar**: Easy-to-use interface for ticker input and analysis
- **Compressed Database**: Fast, optimized storage using Google Drive compression
- **Report Generation**: Comprehensive market analysis reports
- **Multiple Indices Support**: Pre-configured for SPY, ^GSPC, ^DJI, ^IXIC, and more

## 📋 Components

### Google Apps Script Files
- **finCode.gs**: Main GAS file with webhook handlers and data management
- **finSidebar.html**: Interactive UI with ticker input, settings, and instructions
- **Config.html**: Enhanced settings modal with connection testing
- **Instructions.html**: Interactive step-by-step guide modal

### Python Backend
- **app.py**: Flask API server with yfinance integration and AI predictions
- **requirements.txt**: Python dependencies

## 🛠️ Setup Instructions

### 1. Google Apps Script Setup

1. Open Google Sheets and create a new spreadsheet
2. Go to `Extensions` > `Apps Script`
3. Copy the contents of `finCode.gs` into `Code.gs` in the Apps Script editor
4. Create new HTML files: `File` > `New` > `HTML File`
   - Name one `finSidebar` and paste `finSidebar.html` content
   - Name one `Config` and paste `Config.html` content
   - Name one `Instructions` and paste `Instructions.html` content
5. Save the project

### 2. Deploy as Web App

1. In Apps Script editor, click `Deploy` > `New deployment`
2. Select type: `Web app`
3. Set these options:
   - Execute as: **Me**
   - Who has access: **Anyone** (for webhook)
4. Click `Deploy` and copy the Web App URL

### 3. Python Backend Deployment

#### Option A: Deploy to Cloud (Recommended)

**Using Google Cloud Run:**
```bash
cd gas_yfinance_predictor

# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/yfinance-predictor

# Deploy
gcloud run deploy yfinance-predictor \
  --image gcr.io/YOUR_PROJECT_ID/yfinance-predictor \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 5000
```

**Using Heroku:**
```bash
cd gas_yfinance_predictor

# Create Procfile
echo "web: gunicorn app:app" > Procfile

# Deploy
heroku create your-app-name
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a your-app-name
git push heroku Test:main
```

#### Option B: Local Development
```bash
cd gas_yfinance_predictor

# Install dependencies
pip install -r requirements.txt

# Run server
python app.py
```

For production local deployment, use gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 4. Google Drive Setup

1. Create a new Google Drive folder for data storage
2. Right-click the folder and select `Share` > `Get link`
3. Extract the folder ID from the URL:
   ```
   https://drive.google.com/drive/folders/1ABC...xyz
   ```
   The ID is `1ABC...xyz`

### 5. Configure the Application

1. Open your Google Sheet
2. Click the 📚 icon in the sidebar to view instructions, or go to `YFinance Predictor` menu > `📚 Instructions`
3. Click the ⚙️ icon in the sidebar or go to `YFinance Predictor` menu > `⚙️ Configure Settings`
4. Enter:
   - **Python Backend URL**: Your deployed backend URL
   - **Google Drive Folder ID**: The folder ID from step 4
5. Click **Test Connection** to verify backend is reachable
6. Click **Save Configuration**

### 6. Setup Git Webhook

1. Go to your GitHub repository settings
2. Navigate to `Settings` > `Webhooks` > `Add webhook`
3. Configure:
   - **Payload URL**: Your Google Apps Script Web App URL
   - **Content type**: `application/json`
   - **Events**: Select `Push events` and `Pull requests`
4. Click `Add webhook`

## 🎯 Usage

### From Sidebar

1. Open your Google Sheet
2. Click `YFinance Predictor` > `Show Sidebar`
3. Enter a ticker symbol (e.g., AAPL, SPY, ^GSPC)
4. Select time period and interval
5. Click `Fetch & Predict`

### Quick Actions

- **Fetch All Tickers**: Updates all tickers in the Tickers sheet
- **Generate Report**: Creates comprehensive analysis report
- **Popular Indices**: One-click access to major indices

### From Menu

- `Show Sidebar`: Open the prediction interface
- `Fetch All Data`: Update all configured tickers
- `Generate Report`: Create market analysis report
- `Configure Settings`: Update backend and Drive settings
- `Sync with Git`: Manual sync trigger

## 📊 Data Structure

### Tickers Sheet
| Ticker | Name | Last Updated | Current Price | Predicted Price | Confidence |
|--------|------|--------------|---------------|-----------------|------------|
| SPY | S&P 500 ETF | ... | ... | ... | ... |

### Report Sheet
| Ticker | Current Price | Predicted Price | Change % | Recommendation |
|--------|---------------|-----------------|----------|----------------|
| SPY | 450.25 | 455.80 | +1.23% | BUY |

### Webhook Log Sheet
| Timestamp | Event | Repository | Branch | Commits | Author |
|-----------|-------|------------|--------|---------|--------|
| ... | push | ... | Test | 3 | user |

## 🤖 AI Prediction Algorithm

The system uses multiple technical indicators for predictions:

- **Simple Moving Averages (SMA)**: 20-day and 50-day trends
- **Relative Strength Index (RSI)**: Overbought/oversold detection
- **Linear Regression**: Trend analysis
- **Momentum Analysis**: Recent price movement
- **Volatility Calculation**: Risk assessment

Predictions are weighted combinations of these indicators with confidence scoring.

## 🔐 Security Notes

- Store sensitive configuration in Script Properties (not in code)
- Use HTTPS for all backend communications
- Restrict Drive folder permissions appropriately
- Validate webhook signatures in production
- Use environment variables for backend configuration

## 📦 Compressed Database Storage

Data is stored in Google Drive using gzip compression:

- **File format**: `{TICKER}_{TIMESTAMP}.json.gz`
- **Compression ratio**: ~70-80% size reduction
- **Automatic cleanup**: Keeps most recent version
- **Fast retrieval**: Optimized for quick access

## 🔄 Git Webhook Actions

The webhook automatically:
- Logs all push and PR events
- Detects Python file changes
- Triggers data refresh when needed
- Updates ticker information

## 🌐 API Endpoints

### Python Backend

- `GET /health` - Health check
- `POST /api/fetch` - Fetch ticker data
- `POST /api/predict` - Generate price prediction
- `POST /api/generate_report` - Create comprehensive report
- `GET /api/cache/{ticker}` - Get cached data

### Request Examples

**Fetch Data:**
```json
POST /api/fetch
{
  "ticker": "AAPL",
  "period": "1mo",
  "interval": "1d"
}
```

**Get Prediction:**
```json
POST /api/predict
{
  "ticker": "AAPL",
  "data": { ... }
}
```

## 🐛 Troubleshooting

### "Failed to fetch data"
- Check backend URL in configuration
- Verify backend is running
- Check network connectivity

### "Prediction failed"
- Ensure sufficient historical data (>10 data points)
- Check ticker symbol is valid
- Verify backend is accessible

### "Webhook not triggering"
- Verify webhook URL is correct
- Check webhook delivery in GitHub settings
- Review Apps Script execution logs

## 📝 Development

### Local Testing

1. Start backend locally:
```bash
python app.py
```

2. Update configuration with `http://localhost:5000`
3. Test endpoints using curl or Postman

### Adding New Features

- **New indicators**: Add to `generate_ai_prediction()` in app.py
- **Custom tickers**: Add to Tickers sheet
- **New endpoints**: Add routes to app.py and functions to Code.gs

## 📄 License

MIT License - Feel free to use and modify for your needs.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📮 Support

For issues or questions:
- Check the troubleshooting section
- Review Apps Script execution logs
- Check backend server logs
- Open a GitHub issue

## 🎓 Credits

Built with:
- Google Apps Script
- Flask & Python
- yfinance library
- NumPy & Pandas
- Google Drive API

---

**Happy Trading! 📈**
