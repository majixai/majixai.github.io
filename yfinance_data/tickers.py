"""
Comprehensive list of stock tickers for yfinance data collection.
This file contains hundreds of tickers across various sectors and indices.
"""

# Major US Indices
INDICES = [
    "^GSPC",  # S&P 500
    "^DJI",   # Dow Jones Industrial Average
    "^IXIC",  # NASDAQ Composite
    "^RUT",   # Russell 2000
    "^VIX",   # CBOE Volatility Index
]

# Mega Cap Technology
TECH_MEGA = [
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA",
    "AVGO", "ORCL", "ADBE", "CRM", "AMD", "INTC", "CSCO", "QCOM",
    "TXN", "IBM", "NOW", "INTU", "AMAT", "MU", "LRCX", "ADI",
]

# Software & Cloud
SOFTWARE = [
    "PLTR", "SNOW", "DDOG", "ZS", "CRWD", "NET", "OKTA", "WDAY",
    "TEAM", "VEEV", "ZM", "DOCU", "SPLK", "PANW", "FTNT", "ANSS",
    "CDNS", "SNPS", "MRVL", "KLAC", "MPWR", "SWKS", "QRVO", "NXPI",
]

# Semiconductors
SEMICONDUCTORS = [
    "TSM", "ASML", "AEHR", "ALGM", "AMBA", "AOSL", "CRUS", "DIOD",
    "FORM", "IPHI", "LSCC", "MCHP", "MKSI", "MTSI", "OLED", "ON",
    "POWI", "RMBS", "SLAB", "SYNA", "WOLF",
]

# Financial Services
FINANCIALS = [
    "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "USB",
    "PNC", "TFC", "COF", "CME", "ICE", "MCO", "SPGI", "MSCI", "NDAQ",
    "BK", "STT", "DFS", "SYF", "ALLY", "FITB", "KEY", "CFG", "RF",
    "HBAN", "MTB", "ZION", "CMA", "FRC", "SIVB", "WAL", "FCNCA",
]

# Healthcare & Biotech
HEALTHCARE = [
    "JNJ", "UNH", "LLY", "PFE", "ABBV", "MRK", "TMO", "DHR", "ABT",
    "BMY", "AMGN", "GILD", "VRTX", "REGN", "ISRG", "SYK", "BDX",
    "MDT", "ZTS", "CI", "ELV", "HUM", "CVS", "MCK", "CAH", "ABC",
    "DXCM", "IDXX", "ILMN", "A", "IQV", "MTD", "WST", "PKI",
]

# Biotech
BIOTECH = [
    "MRNA", "BIIB", "ALNY", "SGEN", "BMRN", "INCY", "EXEL", "TECH",
    "BIO", "HOLX", "ALGN", "PODD", "NBIX", "SRPT", "RARE", "IONS",
    "IMNN", "HCTI", "IMCC",
]

# Consumer Discretionary
CONSUMER_DISCRETIONARY = [
    "HD", "NKE", "MCD", "SBUX", "TJX", "LOW", "BKNG", "CMG", "MAR",
    "HLT", "YUM", "DG", "DLTR", "ROST", "ORLY", "AZO", "BBY", "ULTA",
    "POOL", "WSM", "TSCO", "DECK", "GRMN", "LVS", "WYNN", "MGM",
    "RCL", "CCL", "NCLH", "LUV", "DAL", "UAL", "AAL",
]

# Consumer Staples
CONSUMER_STAPLES = [
    "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "MDLZ",
    "EL", "KMB", "GIS", "K", "HSY", "SJM", "MKC", "CPB", "HRL",
    "CAG", "CLX", "CHD", "KHC", "STZ", "TAP", "SAM",
]

# Energy
ENERGY = [
    "XOM", "CVX", "COP", "EOG", "SLB", "OXY", "PXD", "PSX", "VLO",
    "MPC", "WMB", "KMI", "OKE", "HAL", "DVN", "HES", "FANG", "BKR",
    "MRO", "APA", "CTRA", "MTDR", "RRC", "EQT", "AR", "SWN", "SM",
]

# Industrials
INDUSTRIALS = [
    "CAT", "DE", "UNP", "UPS", "HON", "RTX", "BA", "LMT", "GE",
    "MMM", "EMR", "ITW", "ETN", "ROK", "PH", "CMI", "PCAR", "FAST",
    "GWW", "AOS", "LIN", "APD", "SHW", "ECL", "DD", "PPG", "DOW",
    "WM", "RSG", "VRSK", "FTV", "IR", "XYL", "CARR", "OTIS", "TT",
]

# Transportation
TRANSPORTATION = [
    "FDX", "NSC", "CSX", "CHRW", "EXPD", "JBHT", "ODFL", "SAIA",
    "XPO", "KNX", "HUBG", "LSTR", "WERN", "SNDR", "ARCB", "GXO",
]

# Aerospace & Defense
AEROSPACE = [
    "NOC", "GD", "LHX", "TDG", "TXT", "HEI", "HWM", "SPR", "AXON",
    "LDOS", "CACI", "SAIC", "MRCY", "KTOS",
]

# Materials
MATERIALS = [
    "FCX", "NEM", "NUE", "STLD", "CLF", "RS", "ATI", "CMC", "X",
    "AA", "CENX", "RIO", "BHP", "VALE", "SCCO", "GOLD", "AEM",
    "KGC", "WPM", "PAAS", "AG", "HL", "CDE", "EXK", "FSM",
]

# Utilities
UTILITIES = [
    "NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "WEC",
    "ED", "ES", "PEG", "FE", "DTE", "ETR", "PPL", "CMS", "AEE",
    "EVRG", "NI", "AES", "CNP", "NRG", "AWK", "WTRG",
]

# Real Estate (REITs)
REITS = [
    "AMT", "PLD", "CCI", "EQIX", "SPG", "PSA", "O", "VICI", "DLR",
    "WELL", "AVB", "EQR", "MAA", "UDR", "ESS", "CPT", "ARE", "BXP",
    "VTR", "OHI", "PEAK", "SUI", "ELS", "CUBE", "LSI", "NSA",
]

# Communication Services
COMMUNICATION = [
    "T", "VZ", "TMUS", "CMCSA", "DIS", "NFLX", "CHTR", "PARA",
    "WBD", "FOX", "FOXA", "LUMN", "LBRDA", "LBRDK", "LYV", "IMAX",
    "MTCH", "ZG", "Z", "YELP", "SNAP", "PINS",
]

# Retail & E-commerce
RETAIL = [
    "TGT", "M", "KSS", "JWN", "DDS", "BURL", "FIVE", "OLLI", "BIG",
    "ANF", "AEO", "GPS", "FL", "BOOT", "CAL", "GCO", "HIBB",
    "PLCE", "SCVL", "URBN", "VSCO", "CATO", "EXPR",
]

# Food & Beverage
FOOD_BEVERAGE = [
    "COKE", "KDP", "MNST", "FIZZ", "CELH", "BYND", "TSN", "HRL",
    "JJSF", "LNDC", "THS", "WW", "USFD", "CHEF", "WING", "TXRH",
    "EAT", "DIN", "CAKE", "DENN", "JACK", "RRGB", "FRGI",
]

# Automotive
AUTOMOTIVE = [
    "F", "GM", "STLA", "TM", "HMC", "RIVN", "LCID", "NIO", "XPEV",
    "LI", "FSR", "GOEV", "FFIE", "MULN", "REE", "SOLO", "PSNY",
    "APTV", "BWA", "LEA", "VC", "ALV", "MTOR", "GTX", "DORM",
    "GNTX", "DAN", "MGA", "THRM",
]

# Payment & Fintech
FINTECH = [
    "V", "MA", "PYPL", "SQ", "AFRM", "UPST", "SOFI", "COIN", "HOOD",
    "FIS", "FISV", "GPN", "ADP", "PAYX", "INTU", "WU", "GDOT",
    "RPAY", "BILL", "NCNO", "MQ", "TOST", "PSFE", "PAYO", "BTRS",
]

# Cybersecurity
CYBERSECURITY = [
    "S", "TENB", "QLYS", "VRNS", "CYBR", "SAIL", "BB", "NLOK",
    "SSTI", "GSAT", "RDWR", "FEYE", "MIME", "RGEN",
]

# Cloud & Data
CLOUD_DATA = [
    "DBX", "BOX", "ESTC", "FIVN", "TWLO", "APPS", "API", "EVBG",
    "CFLT", "MDB", "NEWR", "SUMO", "CLDR", "YEXT", "COUP", "ZUO",
]

# Gaming & Entertainment
GAMING = [
    "EA", "TTWO", "RBLX", "U", "GMBL", "DKNG", "PENN", "CZR",
    "BYD", "CHDN", "IGT", "AGS", "RSI", "SKLZ", "MGNI", "TTD",
    "PUBM", "CRTO", "ROKU", "FUBO",
]

# Cannabis
CANNABIS = [
    "CGC", "TLRY", "CRON", "ACB", "OGI", "HEXO", "SNDL", "VFF",
    "GRWG", "SMG", "IIPR",
]

# Electric Vehicles & Clean Energy
CLEAN_ENERGY = [
    "PLUG", "FCEL", "BLDP", "BE", "ENPH", "SEDG", "RUN", "NOVA",
    "SPWR", "MAXN", "ARRY", "JKS", "DQ", "CSIQ", "FSLR", "GNRC",
    "TAN", "FAN", "ICLN", "QCLN", "PBW",
]

# Crypto-related
CRYPTO = [
    "MSTR", "MARA", "RIOT", "HUT", "BITF", "BTBT", "ARBK", "CLSK",
    "CIFR", "IREN", "GREE",
]

# SPACs & Special Situations
SPECIAL = [
    "BABA", "JD", "PDD", "BIDU", "TME", "BILI", "IQ", "NTES",
    "EDU", "TAL", "GOTU", "ZTO", "VNET", "KC", "TUYA", "YY",
    "HUYA", "DOYU", "API", "DADA", "NIU",
]

# International ADRs
INTERNATIONAL = [
    "TM", "SONY", "NVS", "AZN", "GSK", "SNY", "DEO", "UL", "BTI",
    "BP", "SHEL", "TTE", "EQNR", "E", "SAP", "SHOP", "SE", "GRAB",
    "CPNG", "MELI", "NU",
]

# Small Cap Growth
SMALL_CAP = [
    "UPWK", "ASAN", "ZI", "PATH", "DV", "GTLB", "BRZE", "DOCN",
    "CRDO", "CWAN", "GH", "NARI", "EXAS", "RVMD", "RCKT", "PRTA",
    "AVTR", "TXG", "BEAM", "EDIT", "NTLA", "CRSP",
]

# All tickers combined
ALL_TICKERS = (
    INDICES +
    TECH_MEGA +
    SOFTWARE +
    SEMICONDUCTORS +
    FINANCIALS +
    HEALTHCARE +
    BIOTECH +
    CONSUMER_DISCRETIONARY +
    CONSUMER_STAPLES +
    ENERGY +
    INDUSTRIALS +
    TRANSPORTATION +
    AEROSPACE +
    MATERIALS +
    UTILITIES +
    REITS +
    COMMUNICATION +
    RETAIL +
    FOOD_BEVERAGE +
    AUTOMOTIVE +
    FINTECH +
    CYBERSECURITY +
    CLOUD_DATA +
    GAMING +
    CANNABIS +
    CLEAN_ENERGY +
    CRYPTO +
    SPECIAL +
    INTERNATIONAL +
    SMALL_CAP
)

# Remove duplicates while preserving order
def get_unique_tickers():
    """Return unique tickers list preserving order."""
    seen = set()
    unique = []
    for ticker in ALL_TICKERS:
        if ticker not in seen:
            seen.add(ticker)
            unique.append(ticker)
    return unique


TICKERS = get_unique_tickers()

# Ticker categories for organized data storage
TICKER_CATEGORIES = {
    "indices": INDICES,
    "tech_mega": TECH_MEGA,
    "software": SOFTWARE,
    "semiconductors": SEMICONDUCTORS,
    "financials": FINANCIALS,
    "healthcare": HEALTHCARE,
    "biotech": BIOTECH,
    "consumer_discretionary": CONSUMER_DISCRETIONARY,
    "consumer_staples": CONSUMER_STAPLES,
    "energy": ENERGY,
    "industrials": INDUSTRIALS,
    "transportation": TRANSPORTATION,
    "aerospace": AEROSPACE,
    "materials": MATERIALS,
    "utilities": UTILITIES,
    "reits": REITS,
    "communication": COMMUNICATION,
    "retail": RETAIL,
    "food_beverage": FOOD_BEVERAGE,
    "automotive": AUTOMOTIVE,
    "fintech": FINTECH,
    "cybersecurity": CYBERSECURITY,
    "cloud_data": CLOUD_DATA,
    "gaming": GAMING,
    "cannabis": CANNABIS,
    "clean_energy": CLEAN_ENERGY,
    "crypto": CRYPTO,
    "special": SPECIAL,
    "international": INTERNATIONAL,
    "small_cap": SMALL_CAP,
}

if __name__ == "__main__":
    print(f"Total unique tickers: {len(TICKERS)}")
    print(f"Categories: {len(TICKER_CATEGORIES)}")
    for category, tickers in TICKER_CATEGORIES.items():
        print(f"  {category}: {len(tickers)} tickers")
