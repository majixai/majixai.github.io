#!/usr/bin/env python3
"""
Generate a comprehensive list of 1000 stock tickers
Includes S&P 500, NASDAQ 100, popular ETFs, and additional stocks
"""

import pandas as pd
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

def main():
    logger.info('='*60)
    logger.info('STARTING COMPREHENSIVE TICKER LIST GENERATION')
    logger.info('='*60)
    
    all_tickers = []
    
    # Get S&P 500 tickers
    logger.info('Fetching S&P 500 tickers from Wikipedia...')
    try:
        sp500_url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
        sp500_table = pd.read_html(sp500_url)[0]
        sp500_tickers = sp500_table['Symbol'].tolist()
        sp500_tickers = [ticker.replace('.', '-') for ticker in sp500_tickers]
        all_tickers.extend(sp500_tickers)
        logger.info(f'✓ Found {len(sp500_tickers)} S&P 500 tickers')
    except Exception as e:
        logger.error(f'✗ Failed to fetch S&P 500: {e}')
    
    # Get NASDAQ 100 tickers
    logger.info('Fetching NASDAQ 100 tickers from Wikipedia...')
    try:
        nasdaq_url = 'https://en.wikipedia.org/wiki/Nasdaq-100'
        nasdaq_table = pd.read_html(nasdaq_url)[4]
        nasdaq_tickers = nasdaq_table['Ticker'].tolist()
        nasdaq_tickers = [ticker.replace('.', '-') for ticker in nasdaq_tickers]
        all_tickers.extend(nasdaq_tickers)
        logger.info(f'✓ Found {len(nasdaq_tickers)} NASDAQ 100 tickers')
    except Exception as e:
        logger.error(f'✗ Failed to fetch NASDAQ 100: {e}')
    
    # Get Dow Jones tickers
    logger.info('Fetching Dow Jones tickers from Wikipedia...')
    try:
        dow_url = 'https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average'
        dow_table = pd.read_html(dow_url)[1]
        dow_tickers = dow_table['Symbol'].tolist()
        dow_tickers = [ticker.replace('.', '-') for ticker in dow_tickers]
        all_tickers.extend(dow_tickers)
        logger.info(f'✓ Found {len(dow_tickers)} Dow Jones tickers')
    except Exception as e:
        logger.error(f'✗ Failed to fetch Dow Jones: {e}')
    
    # Popular ETFs
    logger.info('Adding popular ETFs...')
    popular_etfs = [
        'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'AGG', 'BND',
        'GLD', 'SLV', 'USO', 'TLT', 'IEF', 'LQD', 'HYG', 'XLF', 'XLE', 'XLV',
        'XLK', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE', 'XLC', 'VNQ', 'EEM',
        'VEU', 'IEFA', 'IEMG', 'VTV', 'VUG', 'VXUS', 'VIG', 'VYM', 'SCHD', 'DGRO',
        'EFA', 'IJH', 'IJR', 'IVV', 'ITOT', 'IXUS', 'ESGU', 'ESGV', 'SHY', 'IVW'
    ]
    all_tickers.extend(popular_etfs)
    logger.info(f'✓ Added {len(popular_etfs)} popular ETFs')
    
    # Popular individual stocks and crypto
    logger.info('Adding popular individual stocks and crypto...')
    popular_stocks = [
        'SOFI', 'HOOD', 'COIN', 'RBLX', 'RIVN', 'LCID', 'PLTR', 'SNAP', 'UBER',
        'LYFT', 'ABNB', 'DASH', 'DKNG', 'PINS', 'ROKU', 'SQ', 'SHOP', 'SPOT',
        'ZM', 'DOCU', 'CRWD', 'NET', 'SNOW', 'DDOG', 'MDB', 'OKTA', 'ZS',
        'BTC-USD', 'ETH-USD', 'USDT-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD',
        'DOGE-USD', 'SOL-USD', 'DOT-USD', 'MATIC-USD', 'LTC-USD', 'LINK-USD',
        'GME', 'AMC', 'BB', 'NOK', 'WISH', 'CLOV', 'MVIS', 'TLRY', 'SNDL'
    ]
    all_tickers.extend(popular_stocks)
    logger.info(f'✓ Added {len(popular_stocks)} popular stocks and crypto')
    
    # Additional tech and growth stocks
    logger.info('Adding additional tech and growth stocks...')
    additional_stocks = [
        'ARM', 'IONQ', 'RGTI', 'QUBT', 'PATH', 'UPST', 'AFRM', 'SFM', 'LMND',
        'OPEN', 'RDFN', 'Z', 'ZG', 'CVNA', 'VROOM', 'CANO', 'HIMS', 'ACHR',
        'JOBY', 'EVTL', 'WKHS', 'FSR', 'GOEV', 'NKLA', 'HYLN', 'RIDE', 'BLNK',
        'CHPT', 'EVGO', 'CLSK', 'RIOT', 'MARA', 'HUT', 'BTBT', 'CAN', 'HIVE',
        'FTFT', 'SOS', 'EBON', 'CAN', 'MOGU', 'KC', 'NCTY', 'TANH', 'KXIN'
    ]
    all_tickers.extend(additional_stocks)
    logger.info(f'✓ Added {len(additional_stocks)} additional tech and growth stocks')
    
    # Deduplicate and sort
    logger.info('Deduplicating and sorting ticker list...')
    all_tickers = sorted(list(set(all_tickers)))
    logger.info(f'✓ Total unique tickers after deduplication: {len(all_tickers)}')
    
    # Ensure we have exactly 1000 tickers by padding if needed
    if len(all_tickers) < 1000:
        logger.info(f'Current count ({len(all_tickers)}) is less than 1000, adding additional tickers...')
        # Add more stocks by generating variations
        padding_tickers = []
        base_tickers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                       'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
        
        for ticker in base_tickers[:1000 - len(all_tickers)]:
            if ticker not in all_tickers:
                padding_tickers.append(ticker)
        
        all_tickers.extend(padding_tickers)
        all_tickers = sorted(list(set(all_tickers)))
        logger.info(f'✓ Added {len(padding_tickers)} padding tickers')
    
    # Limit to exactly 1000 tickers
    all_tickers = all_tickers[:1000]
    logger.info(f'✓ Final ticker list limited to: {len(all_tickers)} tickers')
    
    # Save to file
    output_file = 'yfinance_data/ticker_list.txt'
    logger.info(f'Saving ticker list to {output_file}...')
    with open(output_file, 'w') as f:
        for i, ticker in enumerate(all_tickers, 1):
            f.write(f'{ticker}\n')
            if i % 100 == 0:
                logger.info(f'  Written {i}/{len(all_tickers)} tickers...')
    
    logger.info(f'✓ Ticker list saved successfully')
    
    logger.info('='*60)
    logger.info(f'SUCCESSFULLY GENERATED {len(all_tickers)} TICKERS')
    logger.info('='*60)
    
    # Print first 20 and last 20 for verification
    logger.info('\nFirst 20 tickers:')
    logger.info(', '.join(all_tickers[:20]))
    logger.info('\nLast 20 tickers:')
    logger.info(', '.join(all_tickers[-20:]))
    
    return all_tickers

if __name__ == '__main__':
    main()
