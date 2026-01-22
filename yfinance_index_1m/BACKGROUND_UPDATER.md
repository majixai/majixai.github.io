# YFinance Background Updater

This system ensures yfinance data is continuously updated in the background, **even when your codespace is offline or stopped**.

## 🚀 How It Works

The system uses **GitHub Actions** to run data collection automatically on a schedule:

### Automatic Updates
- **Every 30 minutes** during US market hours (9:30 AM - 4:00 PM ET, Monday-Friday)
- **Once daily** at 5:00 PM ET for end-of-day data
- **Weekly summary** on Saturdays at noon UTC

### What Gets Updated
- Real-time market data for 10 major indices (S&P 500, Dow Jones, NASDAQ, etc.)
- Multiple timeframes: 1-minute, 5-minute, 1-hour, and daily data
- Technical indicators and summary statistics
- Compressed data files for efficient storage

## 📁 Files Created

```
yfinance_index_1m/
├── index_1m.json          # Latest market data (JSON format)
├── index_1m.dat           # Compressed version (gzip)
├── index_1m.json.zst      # Super-compressed (zstd)
├── logs/
│   ├── last_update.txt    # Timestamp of last update
│   ├── metadata.json      # Update statistics
│   └── update.log         # Detailed logs
├── backups/               # Automatic backups (last 5 kept)
│   └── index_1m.json.backup.YYYYMMDD_HHMMSS
└── data/                  # Historical data archives
```

## 🔧 Setup

### 1. Enable GitHub Actions (Already Done!)

The workflow file is created at:
```
.github/workflows/yfinance_background_updater.yml
```

### 2. Required Secrets (Optional)

For enhanced functionality, add these secrets to your GitHub repository:

- **GH_PAT**: Personal Access Token with `repo` and `workflow` permissions
  - Go to: Settings → Secrets and variables → Actions → New repository secret
  - Name: `GH_PAT`
  - Value: Your GitHub PAT

Without this, the workflow uses the default `GITHUB_TOKEN` (which works fine for most cases).

## 🎮 Usage

### Automatic (Recommended)
Just let it run! GitHub Actions will handle everything automatically.

### Manual Trigger
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **YFinance Background Data Updater**
4. Click **Run workflow**
5. (Optional) Specify custom period/interval
6. Click **Run workflow** button

### Local Testing
Run the updater locally in your codespace:

```bash
cd yfinance_index_1m
python update_data_background.py
```

Or fetch a single index:
```bash
python update_data_background.py --single ^GSPC
```

## 📊 Monitoring

### Check Last Update
```bash
cat yfinance_index_1m/logs/last_update.txt
```

### View Metadata
```bash
cat yfinance_index_1m/logs/metadata.json
```

### Check Workflow Status
- Go to GitHub → Actions tab
- View the latest workflow run
- Check logs for any errors

## 🔍 Viewing the Data

### Using Python
```python
import json

# Load latest data
with open('yfinance_index_1m/index_1m.json', 'r') as f:
    data = json.load(f)

# Access S&P 500 data
sp500 = data['^GSPC']
print(f"S&P 500: ${sp500['summary']['current_price']:.2f}")
print(f"Change: {sp500['summary']['change_pct']:.2f}%")
```

### Using the Web Interface
Open `yfinance_index_1m/index.html` in a browser to see the live dashboard.

## 🛠️ Troubleshooting

### Workflow Not Running?
1. Check GitHub Actions is enabled: Settings → Actions → Allow all actions
2. Verify the schedule cron syntax is correct
3. Check if there are any failed runs in the Actions tab

### Data Not Updating?
1. Check the latest workflow run logs in GitHub Actions
2. Look for errors in `logs/update.log`
3. Verify internet connectivity from GitHub Actions

### Rate Limiting?
If you hit yfinance rate limits:
1. Reduce update frequency (edit the cron schedule)
2. Add delays between requests (modify `update_data_background.py`)

## 🔒 Data Backup

Automatic backups are created before each update:
- Location: `yfinance_index_1m/backups/`
- Retention: Last 5 backups kept
- Format: `index_1m.json.backup.YYYYMMDD_HHMMSS`

To restore from backup:
```bash
cd yfinance_index_1m
cp backups/index_1m.json.backup.YYYYMMDD_HHMMSS index_1m.json
```

## 🧹 Cleanup

Old data files are automatically cleaned up:
- Runs weekly on Saturdays
- Removes files older than 30 days
- Keeps main data files (index_1m.json, etc.)

## 📈 Monitored Indices

| Symbol | Name |
|--------|------|
| ^GSPC | S&P 500 |
| ^DJI | Dow Jones |
| ^IXIC | NASDAQ |
| ^RUT | Russell 2000 |
| ^VIX | VIX (Volatility Index) |
| ^TNX | 10-Year Treasury |
| ^FTSE | FTSE 100 |
| ^GDAXI | DAX |
| ^N225 | Nikkei 225 |
| ^HSI | Hang Seng |

## 🎯 Benefits

✅ **Always Current**: Data updates automatically, no manual intervention needed  
✅ **Codespace Independent**: Runs on GitHub's infrastructure, not your codespace  
✅ **Cost Effective**: Free tier includes 2,000 GitHub Actions minutes/month  
✅ **Reliable**: Automatic retries and error handling  
✅ **Efficient**: Compressed storage with automatic cleanup  
✅ **Backed Up**: Automatic backups before each update  

## 📝 Advanced Configuration

### Change Update Frequency

Edit `.github/workflows/yfinance_background_updater.yml`:

```yaml
schedule:
  # Every hour during market hours
  - cron: '0 14-21 * * 1-5'
  
  # Every 15 minutes during market hours
  - cron: '*/15 14-21 * * 1-5'
```

### Add More Indices

Edit `yfinance_index_1m/update_data_background.py`:

```python
INDICES = {
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',
    # Add more indices here
    '^FCHI': 'CAC 40',
    '^SSEC': 'Shanghai Composite',
}
```

### Customize Data Retention

Edit the cleanup job in `.github/workflows/yfinance_background_updater.yml`:

```bash
# Keep only last 60 days (instead of 30)
find . -name "*.zst" -type f -mtime +60 -delete
```

## 🆘 Support

If you encounter issues:
1. Check the [GitHub Actions logs](../../actions)
2. Review `yfinance_index_1m/logs/update.log`
3. Verify your GitHub Actions quota hasn't been exceeded
4. Ensure yfinance API is accessible (not rate limited)

## 📚 Related Files

- `update_data.py` - Original updater (for manual/local use)
- `update_data_background.py` - Enhanced updater (for GitHub Actions)
- `server.py` - Flask server to serve the data
- `index.html` - Web dashboard

---

**Status**: 🟢 Active and Running  
**Last Updated**: Automatically maintained by GitHub Actions
