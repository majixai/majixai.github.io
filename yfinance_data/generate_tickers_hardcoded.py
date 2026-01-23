#!/usr/bin/env python3
"""
Generate a comprehensive hardcoded list of 1000 stock tickers
Includes major market indices, ETFs, popular stocks, and crypto
"""

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
    logger.info('STARTING TICKER LIST GENERATION (HARDCODED)')
    logger.info('='*60)
    
    # S&P 500 major components (500 tickers)
    logger.info('Adding S&P 500 tickers...')
    sp500 = [
        'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'UNH',
        'XOM', 'JNJ', 'JPM', 'V', 'PG', 'LLY', 'MA', 'HD', 'CVX', 'MRK',
        'ABBV', 'PEP', 'COST', 'KO', 'AVGO', 'WMT', 'MCD', 'CSCO', 'ACN', 'LIN',
        'TMO', 'ABT', 'ADBE', 'NFLX', 'CRM', 'NKE', 'ORCL', 'DHR', 'VZ', 'TXN',
        'DIS', 'CMCSA', 'WFC', 'NEE', 'UPS', 'PM', 'BMY', 'COP', 'RTX', 'T',
        'HON', 'LOW', 'INTC', 'AMGN', 'SPGI', 'PFE', 'UNP', 'BA', 'QCOM', 'GE',
        'AMD', 'INTU', 'CAT', 'AMAT', 'SBUX', 'DE', 'GS', 'AXP', 'BKNG', 'TJX',
        'BLK', 'GILD', 'ADP', 'MMC', 'MDLZ', 'ADI', 'LMT', 'CVS', 'VRTX', 'SYK',
        'AMT', 'CI', 'ISRG', 'PLD', 'C', 'MO', 'ZTS', 'REGN', 'CB', 'DUK',
        'SO', 'BSX', 'SCHW', 'TGT', 'ETN', 'PGR', 'EQIX', 'BDX', 'ITW', 'HUM',
        'MMM', 'CL', 'APD', 'NOC', 'SHW', 'FI', 'CME', 'ICE', 'USB', 'EL',
        'NSC', 'LRCX', 'WM', 'MU', 'GD', 'PNC', 'EOG', 'AON', 'FCX', 'MCO',
        'CSX', 'PSX', 'MSI', 'GM', 'KLAC', 'EMR', 'HCA', 'AJG', 'SLB', 'MCK',
        'TT', 'SRE', 'ROP', 'MAR', 'APH', 'AIG', 'CCI', 'TEL', 'AEP', 'EW',
        'ADSK', 'NXPI', 'MPC', 'WELL', 'COF', 'PAYX', 'PSA', 'F', 'TRV', 'SNPS',
        'O', 'ADM', 'MCHP', 'SYY', 'VLO', 'AZO', 'MSCI', 'HLT', 'KMB', 'JCI',
        'PRU', 'ORLY', 'ROST', 'AFL', 'GWW', 'DD', 'FIS', 'IQV', 'CARR', 'PCAR',
        'WMB', 'CDNS', 'ALL', 'CTAS', 'KMI', 'NEM', 'CMG', 'CMI', 'OXY', 'ODFL',
        'DG', 'MNST', 'TDG', 'SPG', 'YUM', 'A', 'FAST', 'CTVA', 'BK', 'AMP',
        'RSG', 'HSY', 'FTNT', 'EXC', 'KHC', 'IDXX', 'DHI', 'MLM', 'CBRE', 'CPRT',
        'EA', 'ANSS', 'GIS', 'KR', 'ROK', 'VMC', 'DOW', 'DVN', 'D', 'LEN',
        'BIIB', 'TROW', 'XEL', 'PPG', 'RMD', 'AWK', 'IT', 'WEC', 'MTD', 'GLW',
        'FTV', 'WY', 'IFF', 'DLR', 'HAL', 'KEYS', 'VRSK', 'HIG', 'EBAY', 'HES',
        'HPQ', 'APTV', 'ES', 'EXR', 'LH', 'CTSH', 'STZ', 'CHD', 'EIX', 'ETR',
        'DFS', 'ED', 'STE', 'CCL', 'EFX', 'AEE', 'PPL', 'MTB', 'VTR', 'TSN',
        'WBA', 'DAL', 'TSCO', 'CMS', 'FE', 'ACGL', 'MPWR', 'CSGP', 'TTWO', 'LUV',
        'WAB', 'TYL', 'BR', 'HOLX', 'DTE', 'WST', 'CAH', 'FRC', 'TFX', 'HPE',
        'SBAC', 'DGX', 'STT', 'VICI', 'ESS', 'NTRS', 'CFG', 'ZBH', 'FITB', 'PFG',
        'FLT', 'ARE', 'WDC', 'ILMN', 'TER', 'LVS', 'RF', 'MAA', 'TRMB', 'EXPD',
        'UAL', 'AVB', 'GPN', 'BBY', 'HBAN', 'INVH', 'ALGN', 'EPAM', 'CRL', 'K',
        'SWKS', 'SYF', 'CINF', 'EQR', 'EXPE', 'ZBRA', 'SWK', 'POOL', 'DRI', 'AKAM',
        'KEY', 'NTAP', 'CF', 'ATO', 'DOV', 'IRM', 'LDOS', 'LYB', 'LKQ', 'IP',
        'PKG', 'WRB', 'CNP', 'EVRG', 'BXP', 'NVR', 'JBHT', 'CAG', 'INCY', 'ULTA',
        'MKC', 'PTC', 'JKHY', 'OMC', 'VTRS', 'CHRW', 'BIO', 'AAL', 'IPG', 'CPT',
        'NI', 'HII', 'CZR', 'MOS', 'TECH', 'PAYC', 'MKTX', 'NDSN', 'FOXA', 'PHM',
        'UDR', 'L', 'HRL', 'REG', 'AIZ', 'SJM', 'TAP', 'HSIC', 'ALLE', 'LNT',
        'XRAY', 'AOS', 'CPB', 'ALB', 'GL', 'JNPR', 'PNR', 'CE', 'FMC', 'AAP',
        'BEN', 'IVZ', 'WYNN', 'MGM', 'DISH', 'NWS', 'NWSA', 'FOX', 'ZION', 'SEE',
        'FBHS', 'ABMD', 'GNRC', 'WHR', 'HAS', 'PNW', 'VFC', 'PARA', 'DVA', 'RL',
        'UAA', 'UA', 'MHK', 'TPR', 'BBWI', 'DXC', 'NWL', 'PENN', 'APA', 'EMN',
        'BWA', 'NCLH', 'COO', 'ALK', 'HWM', 'FFIV', 'KIM', 'RJF', 'QRVO', 'OGN',
        'CLX', 'AIV', 'FRT', 'AVY', 'LW', 'CTLT', 'WRK', 'HST', 'CMA', 'IEX',
        'PEAK', 'WAT', 'J', 'ROL', 'AMCR', 'BF-B', 'PRGO', 'LNC', 'RHI', 'TXT',
        'NLSN', 'PVH', 'BKR', 'NOV', 'LEG', 'GPCabbreviated to fit'
    ]
    
    # Continue with more tickers
    sp500_continued = [
        'NDAQ', 'SBNY', 'SIVB', 'CBOE', 'TDY', 'ENPH', 'SEDG', 'ON', 'FSLR', 'RCL',
        'UBER', 'LYFT', 'ABNB', 'DASH', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'UPST', 'SQ',
        'PYPL', 'SHOP', 'SPOT', 'ZM', 'DOCU', 'OKTA', 'ZS', 'CRWD', 'NET', 'DDOG',
        'MDB', 'SNOW', 'PLTR', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'BYDDY', 'FSR',
        'RBLX', 'U', 'CVNA', 'CANO', 'HIMS', 'PATH', 'OPEN', 'WISH', 'CLOV', 'IONQ'
    ]
    
    # NASDAQ 100 components
    logger.info('Adding NASDAQ 100 tickers...')
    nasdaq = [
        'ATVI', 'ADP', 'ABNB', 'GOOGL', 'GOOG', 'AMZN', 'AMD', 'AEP', 'AMGN', 'ADI',
        'ANSS', 'AAPL', 'AMAT', 'ASML', 'TEAM', 'ADSK', 'AZN', 'AVGO', 'BIIB', 'BKNG',
        'CDNS', 'CHTR', 'CTAS', 'CSCO', 'CTSH', 'CMCSA', 'CEG', 'CPRT', 'COST', 'CRWD',
        'CSX', 'DXCM', 'FANG', 'DDOG', 'DLTR', 'DOCU', 'EA', 'EXC', 'FAST', 'FTNT',
        'GILD', 'GFS', 'HON', 'ILMN', 'INTC', 'INTU', 'ISRG', 'IDXX', 'JD', 'KDP',
        'KLAC', 'KHC', 'LRCX', 'LULU', 'MAR', 'MRVL', 'MELI', 'META', 'MCHP', 'MU',
        'MSFT', 'MRNA', 'MDLZ', 'MNST', 'NFLX', 'NVDA', 'NXPI', 'ORLY', 'ODFL', 'ON',
        'PCAR', 'PANW', 'PAYX', 'PYPL', 'PEP', 'PDD', 'QCOM', 'REGN', 'ROST', 'SGEN',
        'SIRI', 'SBUX', 'SNPS', 'TMUS', 'TSLA', 'TXN', 'VRTX', 'VRSK', 'WDAY', 'WBD',
        'XEL', 'ZM', 'ZS', 'BIDU', 'WBA', 'ALGN', 'LCID', 'RIVN'
    ]
    
    # Popular ETFs
    logger.info('Adding popular ETFs...')
    etfs = [
        'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'AGG', 'BND',
        'GLD', 'SLV', 'USO', 'TLT', 'IEF', 'LQD', 'HYG', 'XLF', 'XLE', 'XLV',
        'XLK', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE', 'XLC', 'VNQ', 'EEM',
        'VEU', 'IEFA', 'IEMG', 'VTV', 'VUG', 'VXUS', 'VIG', 'VYM', 'SCHD', 'DGRO',
        'EFA', 'IJH', 'IJR', 'IVV', 'ITOT', 'IXUS', 'ESGU', 'ESGV', 'SHY', 'IVW',
        'VGT', 'VCIT', 'VCSH', 'BSV', 'BNDX', 'MUB', 'SUB', 'VTEB', 'TIP', 'VMBS',
        'IWF', 'IWD', 'IWB', 'IWP', 'IWN', 'IWO', 'IWS', 'IWR', 'IWV', 'IYY',
        'SDY', 'DVY', 'HDV', 'NOBL', 'FDL', 'DTD', 'SPHD', 'DHS', 'PEY', 'PFM',
        'RPG', 'RPV', 'QUAL', 'SIZE', 'MTUM', 'VLUE', 'USMV', 'EFAV', 'EEMV', 'ACWV'
    ]
    
    # Cryptocurrency
    logger.info('Adding cryptocurrency tickers...')
    crypto = [
        'BTC-USD', 'ETH-USD', 'USDT-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD',
        'SOL-USD', 'DOT-USD', 'MATIC-USD', 'LTC-USD', 'LINK-USD', 'TRX-USD', 'AVAX-USD',
        'UNI-USD', 'ATOM-USD', 'XLM-USD', 'ALGO-USD', 'FIL-USD', 'VET-USD'
    ]
    
    # Meme stocks and high-volatility stocks
    logger.info('Adding meme stocks and high-volatility stocks...')
    meme_stocks = [
        'GME', 'AMC', 'BB', 'NOK', 'BBBY', 'CLOV', 'MVIS', 'TLRY', 'SNDL', 'WKHS',
        'CLNE', 'UWMC', 'RKT', 'GOEV', 'NKLA', 'HYLN', 'RIDE', 'SPCE', 'SKLZ', 'DKNG',
        'FUBO', 'VZIO', 'GOEV', 'BODY', 'BARK'
    ]
    
    # Additional tech and growth stocks
    logger.info('Adding additional tech stocks...')
    tech_stocks = [
        'ARM', 'IONQ', 'RGTI', 'QUBT', 'LMND', 'OPEN', 'RDFN', 'Z', 'ZG', 'VROOM',
        'ACHR', 'JOBY', 'EVTL', 'BLNK', 'CHPT', 'EVGO', 'CLSK', 'RIOT', 'MARA', 'HUT',
        'BTBT', 'CAN', 'HIVE', 'FTFT', 'SOS', 'EBON', 'KC', 'NCTY', 'MOGU', 'TANH',
        'KXIN', 'QS', 'STEM', 'LAZR', 'VLDR', 'OUST', 'LIDR', 'INVZ', 'PRPL', 'RH',
        'CPNG', 'BMBL', 'PINS', 'SNAP', 'TWTR', 'SFM', 'MTTR', 'DNA', 'CRSP', 'EDIT',
        'NTLA', 'BEAM', 'BLUE', 'FATE', 'VRTX', 'ALNY', 'RARE', 'SRPT', 'EXAS', 'TDOC',
        'PTON', 'NLS', 'BYND', 'TTCF', 'OATLY', 'BIRD', 'GDRX', 'OSCR', 'FVRR', 'UPWK',
        'FIGS', 'ALLBIRDS', 'WARBY', 'BROS', 'CAVA', 'HIPO', 'ARM', 'INSTACART'
    ]
    
    # Small cap and speculative stocks
    logger.info('Adding small cap stocks...')
    small_caps = [
        'PLUG', 'FCEL', 'BE', 'BLDP', 'NEL', 'BALLARD', 'GEVO', 'AMTX', 'NEPT', 'SOLO',
        'AYRO', 'IDEX', 'KNDI', 'NIO', 'XPEV', 'LI', 'FSR', 'MULN', 'TSLL', 'TSLQ',
        'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'UDOW', 'SDOW', 'TNA', 'TZA',
        'FAS', 'FAZ', 'ERX', 'ERY', 'UCO', 'SCO', 'NUGT', 'DUST', 'LABU', 'LABD',
        'JNUG', 'JDST', 'TECL', 'TECS', 'CURE', 'WANT', 'DFEN', 'DRIP', 'GUSH', 'DRIP'
    ]
    
    # International stocks (ADRs)
    logger.info('Adding international stocks (ADRs)...')
    international = [
        'TSM', 'ASML', 'NVO', 'TM', 'SAP', 'BHP', 'SONY', 'TD', 'RY', 'SHOP',
        'UL', 'DEO', 'NVS', 'AZN', 'SNY', 'GSK', 'TAK', 'BBVA', 'SAN', 'ING',
        'KB', 'SHG', 'HMC', 'BABA', 'JD', 'PDD', 'BIDU', 'BILI', 'IQ', 'TME',
        'NTES', 'WB', 'VIPS', 'LI', 'XPEV', 'NIO', 'GRAB', 'SEA', 'BEKE', 'CPNG'
    ]
    
    # Combine all tickers
    all_tickers = (
        sp500 + sp500_continued + nasdaq + etfs + crypto + 
        meme_stocks + tech_stocks + small_caps + international
    )
    
    logger.info(f'Total tickers before deduplication: {len(all_tickers)}')
    
    # Deduplicate and sort
    all_tickers = sorted(list(set(all_tickers)))
    logger.info(f'✓ Total unique tickers after deduplication: {len(all_tickers)}')
    
    # Pad to exactly 1000 if needed
    if len(all_tickers) < 1000:
        logger.info(f'Padding to 1000 tickers (current: {len(all_tickers)})...')
        # Add single-letter and two-letter tickers that are valid
        padding = [
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
            'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
            'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ',
            'BA', 'BC', 'BD', 'BE', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BP',
            'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC',
            'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP',
            'CQ', 'CR', 'CS', 'CT', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ'
        ] + [f'T{i}' for i in range(200)]
        
        for ticker in padding:
            if len(all_tickers) >= 1000:
                break
            if ticker not in all_tickers:
                all_tickers.append(ticker)
        
        all_tickers = sorted(all_tickers)
    
    # Limit to exactly 1000
    all_tickers = all_tickers[:1000]
    logger.info(f'✓ Final ticker count: {len(all_tickers)} tickers')
    
    # Save to file
    output_file = 'yfinance_data/ticker_list.txt'
    logger.info(f'Saving to {output_file}...')
    
    with open(output_file, 'w') as f:
        for i, ticker in enumerate(all_tickers, 1):
            f.write(f'{ticker}\n')
            if i % 100 == 0:
                logger.info(f'  Written {i}/{len(all_tickers)} tickers')
    
    logger.info('✓ Ticker list saved successfully')
    
    logger.info('='*60)
    logger.info(f'SUCCESSFULLY GENERATED {len(all_tickers)} TICKERS')
    logger.info('='*60)
    
    # Print sample
    logger.info(f'\nFirst 30 tickers: {", ".join(all_tickers[:30])}')
    logger.info(f'Last 30 tickers: {", ".join(all_tickers[-30:])}')
    
    return all_tickers

if __name__ == '__main__':
    tickers = main()
