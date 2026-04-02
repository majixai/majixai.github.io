"""
Comprehensive list of stock tickers for yfinance data collection.
This file contains 1300+ tickers across various sectors and indices.
"""

# Major US & Global Indices
INDICES = [
    "^GSPC",    # S&P 500
    "^DJI",     # Dow Jones Industrial Average
    "^IXIC",    # NASDAQ Composite
    "^RUT",     # Russell 2000
    "^VIX",     # CBOE Volatility Index
    "^FTSE",    # FTSE 100
    "^N225",    # Nikkei 225
    "^HSI",     # Hang Seng Index
    "^GDAXI",   # DAX
    "^FCHI",    # CAC 40
    "^STOXX50E", # EURO STOXX 50
    "^BVSP",    # Bovespa (Brazil)
    "^NSEI",    # NIFTY 50 (India)
]

# Mega Cap Technology
TECH_MEGA = [
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA",
    "AVGO", "ORCL", "ADBE", "CRM", "AMD", "INTC", "CSCO", "QCOM",
    "TXN", "IBM", "NOW", "INTU", "AMAT", "MU", "LRCX", "ADI",
    "NFLX", "UBER", "ABNB", "DASH", "ARM", "SMCI", "SHOP", "SE",
    "BIDU", "GRAB", "WIX", "GDDY", "TTD", "ZG",
]

# Software & Cloud
SOFTWARE = [
    "PLTR", "SNOW", "DDOG", "ZS", "CRWD", "NET", "OKTA", "WDAY",
    "TEAM", "VEEV", "ZM", "DOCU", "SPLK", "PANW", "FTNT", "ANSS",
    "CDNS", "SNPS", "MRVL", "KLAC", "MPWR", "SWKS", "QRVO", "NXPI",
    "HUBS", "MNDY", "TASK", "RNG", "NICE", "SMAR", "APPN", "PEGA",
    "PRFT", "EPAM", "GLOB", "JAMF", "BSY", "INTA", "PCOR", "FRSH",
    "DOMO", "ALRM", "SPSC", "AZPN", "MANH", "BRZE", "GTLB", "ASAN",
    "ZI", "PATH", "DOCN",
]

# Semiconductors
SEMICONDUCTORS = [
    "TSM", "ASML", "AEHR", "ALGM", "AMBA", "AOSL", "CRUS", "DIOD",
    "FORM", "IPHI", "LSCC", "MCHP", "MKSI", "MTSI", "OLED", "ON",
    "POWI", "RMBS", "SLAB", "SYNA", "WOLF",
    "ENTG", "CCMP", "ACMR", "COHU", "ONTO", "ICHR", "UCTT", "ACLS",
    "NVMI", "CAMT", "AXTI", "PLAB", "AZTA", "IIVI", "KLIC", "AMKR",
    "SITM", "MGNI", "MPWR",
]

# Financial Services
# Note: FRC (First Republic Bank) and SIVB (Silicon Valley Bank) were removed
# as both institutions failed in March 2023 and are no longer tradeable.
FINANCIALS = [
    "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "USB",
    "PNC", "TFC", "COF", "CME", "ICE", "MCO", "SPGI", "MSCI", "NDAQ",
    "BK", "STT", "DFS", "SYF", "ALLY", "FITB", "KEY", "CFG", "RF",
    "HBAN", "MTB", "ZION", "CMA", "WAL", "FCNCA",
    "DB", "UBS", "HSBC", "TD", "RY", "ING", "BBVA", "BCS",
    "NLY", "AGNC", "TWO", "EARN", "OZK", "BOKF", "FFIN",
    "GBCI", "IBOC", "SFNC", "RNST", "CBTX", "SRCE", "TBNK", "CVBF",
    "FBIZ", "FBMS", "HFWA", "HTLF", "HOPE", "INDB",
]

# Healthcare & Biotech
HEALTHCARE = [
    "JNJ", "UNH", "LLY", "PFE", "ABBV", "MRK", "TMO", "DHR", "ABT",
    "BMY", "AMGN", "GILD", "VRTX", "REGN", "ISRG", "SYK", "BDX",
    "MDT", "ZTS", "CI", "ELV", "HUM", "CVS", "MCK", "CAH", "ABC",
    "DXCM", "IDXX", "ILMN", "A", "IQV", "MTD", "WST", "PKI",
    "BSX", "EW", "RMD", "ZBH", "STE", "BAX", "PDCO", "HSIC",
    "DVA", "MOH", "CNC", "HCA", "THC", "ENSG", "AMED", "LHCG",
    "HCSG", "MEDNAX", "HAE", "TFX", "NVST", "ICLR", "MEDP", "CRVL",
    "PINC", "ACCD", "ONEM", "HCAT", "PHYC", "CANO",
]

# Biotech
BIOTECH = [
    "MRNA", "BIIB", "ALNY", "SGEN", "BMRN", "INCY", "EXEL", "TECH",
    "BIO", "HOLX", "ALGN", "PODD", "NBIX", "SRPT", "RARE", "IONS",
    "IMNN", "HCTI", "IMCC",
    "HZNP", "ACAD", "FOLD", "ARWR", "PCVX", "IMVT", "NKTR", "FATE",
    "AGEN", "APLT", "ARDX", "BLUE", "CALA", "CBPO", "CDXS", "CERS",
    "CLVS", "CRBP", "DCPH", "DNLI", "ERAS", "HALO", "JNCE", "KALA",
    "LYEL", "MIRM", "NBTX", "OCUL", "PHAT", "PRVB", "RCUS", "RLAY",
    "RXRX", "SAGE", "SRRX", "TGTX", "TNXP", "VRNA", "XNCR",
]

# Consumer Discretionary
CONSUMER_DISCRETIONARY = [
    "HD", "NKE", "MCD", "SBUX", "TJX", "LOW", "BKNG", "CMG", "MAR",
    "HLT", "YUM", "DG", "DLTR", "ROST", "ORLY", "AZO", "BBY", "ULTA",
    "POOL", "WSM", "TSCO", "DECK", "GRMN", "LVS", "WYNN", "MGM",
    "RCL", "CCL", "NCLH", "LUV", "DAL", "UAL", "AAL",
    "EBAY", "ETSY", "CHWY", "W", "RH", "TPR", "CPRI", "PVH",
    "HBI", "VFC", "LEVI", "GES", "UAA", "CROX", "SHOO", "OXM",
    "TUP", "TUMI", "BURL", "FIVE", "OLLI", "BBW", "PRGY",
    "CAKE", "DENN", "RRGB", "JACK", "DIN", "EAT",
]

# Consumer Staples
CONSUMER_STAPLES = [
    "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "MDLZ",
    "EL", "KMB", "GIS", "K", "HSY", "SJM", "MKC", "CPB", "HRL",
    "CAG", "CLX", "CHD", "KHC", "STZ", "TAP", "SAM",
    "SFM", "GO", "KR", "SYY", "BJ", "CASY", "USFD", "ACI",
    "INGR", "CENTA", "SENEA", "LANC", "JJSF", "PFGC", "ATR",
    "SON", "SEE", "BMS", "PKG", "IP", "WRK", "CCK", "SLVM",
]

# Energy
ENERGY = [
    "XOM", "CVX", "COP", "EOG", "SLB", "OXY", "PXD", "PSX", "VLO",
    "MPC", "WMB", "KMI", "OKE", "HAL", "DVN", "HES", "FANG", "BKR",
    "MRO", "APA", "CTRA", "MTDR", "RRC", "EQT", "AR", "SWN", "SM",
    "LNG", "CIVI", "NOG", "PR", "CHRD", "VTLE", "REI", "SBOW",
    "FLNG", "GLNG", "CLMT", "PARR", "DINO", "CAPL", "DKL",
    "ENLC", "TRGP", "AM", "DT", "GTLS", "ACDC", "AMPY", "BATL",
    "ESTE", "HLX", "HPK", "MEG", "MNRL", "NOG", "PHX", "ROCC",
]

# Industrials
INDUSTRIALS = [
    "CAT", "DE", "UNP", "UPS", "HON", "RTX", "BA", "LMT", "GE",
    "MMM", "EMR", "ITW", "ETN", "ROK", "PH", "CMI", "PCAR", "FAST",
    "GWW", "AOS", "LIN", "APD", "SHW", "ECL", "DD", "PPG", "DOW",
    "WM", "RSG", "VRSK", "FTV", "IR", "XYL", "CARR", "OTIS", "TT",
    "SPXC", "KBR", "HII", "OSK", "SWK", "HOLI", "NPO", "MWA",
    "AWI", "CFX", "WTS", "AZEK", "FBHS", "AAON", "IIIN", "WOR",
    "MIDD", "RRX", "NDSN", "FLOW", "AGCO", "CNH", "TTC", "XONE",
    "GNSS", "ACCO", "GFF", "TREX", "NPO", "SXC", "AIRC", "IEX",
]

# Transportation
TRANSPORTATION = [
    "FDX", "NSC", "CSX", "CHRW", "EXPD", "JBHT", "ODFL", "SAIA",
    "XPO", "KNX", "HUBG", "LSTR", "WERN", "SNDR", "ARCB", "GXO",
    "CP", "CNI", "WAB", "GBX", "GATX", "R", "HTZ", "ABG", "PAG",
    "AN", "LAD", "CVNA", "LYFT", "WLFC", "AAWW", "ATSG", "ECHO",
    "MRTN", "PTSI", "HTLD", "USA", "USX", "DSKE", "EXP",
]

# Aerospace & Defense
AEROSPACE = [
    "NOC", "GD", "LHX", "TDG", "TXT", "HEI", "HWM", "SPR", "AXON",
    "LDOS", "CACI", "SAIC", "MRCY", "KTOS",
    "BWXT", "DRS", "CW", "ERJ", "ACHR", "JOBY", "LILM", "RKLB",
    "ASTR", "MNTS", "ASTS", "SPCE", "PL", "MAXR", "IRDM", "ATRO",
    "HEI", "AIR", "HEICO", "DEN", "MOOG", "ESLT", "FLIR", "FTNT",
]

# Materials
MATERIALS = [
    "FCX", "NEM", "NUE", "STLD", "CLF", "RS", "ATI", "CMC", "X",
    "AA", "CENX", "RIO", "BHP", "VALE", "SCCO", "GOLD", "AEM",
    "KGC", "WPM", "PAAS", "AG", "HL", "CDE", "EXK", "FSM",
    "LYB", "EMN", "HUN", "TROX", "CE", "OLN", "FMC", "MEOH",
    "ASIX", "CC", "ALB", "AVNT", "KALU", "HWKN", "MTRN",
    "OLIN", "SQM", "MP", "LAC", "PLL", "LTHM", "ALTM", "PGLD",
    "GFI", "HMY", "AU", "BTG", "SSRM", "OR", "MAG",
]

# Utilities
UTILITIES = [
    "NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "WEC",
    "ED", "ES", "PEG", "FE", "DTE", "ETR", "PPL", "CMS", "AEE",
    "EVRG", "NI", "AES", "CNP", "NRG", "AWK", "WTRG",
    "OGE", "SWX", "NWE", "OTTR", "AVA", "IDA", "MGEE", "MDU",
    "BKH", "ATO", "LNT", "PNW", "POR", "UTL", "UGI", "SR",
    "ONE", "WGL", "LABL", "ARTNA", "MSEX", "SJW", "YORW",
]

# Real Estate (REITs)
REITS = [
    "AMT", "PLD", "CCI", "EQIX", "SPG", "PSA", "O", "VICI", "DLR",
    "WELL", "AVB", "EQR", "MAA", "UDR", "ESS", "CPT", "ARE", "BXP",
    "VTR", "OHI", "PEAK", "SUI", "ELS", "CUBE", "LSI", "NSA",
    "WPC", "NNN", "STAG", "FR", "COLD", "REXR", "TRNO", "INVH",
    "AMH", "NHI", "LTC", "IRM", "WY", "RYN", "PCH", "UNIT",
    "SBAC", "SAFE", "CLPR", "NXRT", "ALEX", "DEI", "VNO", "SLG",
    "PDM", "HPP", "CIO", "KIM", "REG", "ROIC", "SITC", "RPAI",
    "HIW", "BRT", "GNL", "GTY", "PINE", "ADC", "BNL", "EPRT",
]

# Communication Services
COMMUNICATION = [
    "T", "VZ", "TMUS", "CMCSA", "DIS", "NFLX", "CHTR", "PARA",
    "WBD", "FOX", "FOXA", "LUMN", "LBRDA", "LBRDK", "LYV", "IMAX",
    "MTCH", "ZG", "Z", "YELP", "SNAP", "PINS",
    "DISH", "SIRI", "WMG", "SPOT", "IAC", "ANGI", "TRIP", "GEN",
    "NWSA", "AMCX", "CABO", "BATRA", "FWONA", "NLSN", "CARS",
    "RDFN", "OPRA", "EIGI", "EVIO", "TRUE", "CARG", "SEAT",
]

# Retail & E-commerce
RETAIL = [
    "TGT", "M", "KSS", "JWN", "DDS", "BURL", "FIVE", "OLLI", "BIG",
    "ANF", "AEO", "GPS", "FL", "BOOT", "CAL", "GCO", "HIBB",
    "PLCE", "SCVL", "URBN", "VSCO", "CATO", "EXPR",
    "SIG", "AAP", "CONN", "RCII", "HOFT", "PRTY", "BGFV",
    "BNED", "REAL", "FTCH", "RENT", "OSTK", "W", "ECOM",
    "CROX", "SHOO", "TLYS", "ZUMZ", "SNBR", "GIII", "KOSS",
    "DSGN", "LULU", "SKX", "DECK", "CROCS",
]

# Food & Beverage
FOOD_BEVERAGE = [
    "COKE", "KDP", "MNST", "FIZZ", "CELH", "BYND", "TSN", "HRL",
    "JJSF", "LNDC", "THS", "WW", "USFD", "CHEF", "WING", "TXRH",
    "EAT", "DIN", "CAKE", "DENN", "JACK", "RRGB", "FRGI",
    "DPZ", "PZZA", "BLMN", "BJRI", "SHAK", "CBRL", "FAT", "RUTH",
    "KRUS", "NATH", "PPC", "UTZ", "VERY", "LWAY", "SMFG",
    "SEB", "LANC", "SENEA", "JBSS", "SASR", "BROS", "COSI",
    "HABT", "NDLS", "ARCO", "LOCO", "DINE",
]

# Automotive
AUTOMOTIVE = [
    "F", "GM", "STLA", "TM", "HMC", "RIVN", "LCID", "NIO", "XPEV",
    "LI", "FSR", "GOEV", "FFIE", "MULN", "REE", "SOLO", "PSNY",
    "APTV", "BWA", "LEA", "VC", "ALV", "MTOR", "GTX", "DORM",
    "GNTX", "DAN", "MGA", "THRM",
    "NKLA", "BLBD", "WGO", "THO", "PATK", "LKQ", "DRVN", "MONRO",
    "STRT", "GT", "SUP", "FOXF", "DORMAN", "MPAA", "LCII",
    "CVNA", "KMX", "ABG", "PAG", "AN", "LAD", "SAH", "GPI",
    "CARG", "IAA", "VRM", "BEEM", "HYLN", "HYZN",
]

# Payment & Fintech
FINTECH = [
    "V", "MA", "PYPL", "SQ", "AFRM", "UPST", "SOFI", "COIN", "HOOD",
    "FIS", "FISV", "GPN", "ADP", "PAYX", "INTU", "WU", "GDOT",
    "RPAY", "BILL", "NCNO", "MQ", "TOST", "PSFE", "PAYO", "BTRS",
    "WEX", "XP", "FOUR", "STNE", "PAGS", "FLYW", "IIIV", "PAX",
    "SLM", "NAVI", "OMF", "CACC", "ECPG", "PFSI", "RKT", "UWMC",
    "MC", "EVR", "LAZ", "PJT", "CODI", "IIIV", "RELY",
    "EZCORP", "DFC", "CSGP", "OPEN", "OPFI", "ATLC",
]

# Cybersecurity
CYBERSECURITY = [
    "S", "TENB", "QLYS", "VRNS", "CYBR", "SAIL", "BB", "NLOK",
    "SSTI", "GSAT", "RDWR", "FEYE", "MIME", "RGEN",
    "PSTG", "RPD", "DT", "AKAM", "CIEN", "VIAV", "ADTRAN",
    "JNPR", "CALX", "INFN", "NTCT", "SNET", "SCWX", "MOBL",
    "INPX", "SFOR", "ZTA", "LTRX", "ATEN", "BAND", "EQIX",
]

# Cloud & Data
CLOUD_DATA = [
    "DBX", "BOX", "ESTC", "FIVN", "TWLO", "APPS", "API", "EVBG",
    "CFLT", "MDB", "NEWR", "SUMO", "CLDR", "YEXT", "COUP", "ZUO",
    "WIX", "WEAV", "APPF", "PRGS", "BLKB", "VMEO", "RAMP", "SQSP",
    "ALTR", "PCTY", "PAYC", "HCM", "SMAR", "ASANA", "AGIO",
    "BAND", "AVLR", "BIGC", "VTEX", "SEMR", "STAX", "CLOU",
]

# Gaming & Entertainment
GAMING = [
    "EA", "TTWO", "RBLX", "U", "GMBL", "DKNG", "PENN", "CZR",
    "BYD", "CHDN", "IGT", "AGS", "RSI", "SKLZ", "MGNI", "TTD",
    "PUBM", "CRTO", "ROKU", "FUBO",
    "ATVI", "GENI", "EVERI", "SGMS", "MCRI", "GAN", "DMS",
    "FLUT", "BETZ", "GAMB", "GMRS", "ESPO", "HERO", "NERD",
    "KRTX", "SRAD", "NCMI", "AMC", "CNK", "IMAX",
]

# Cannabis
CANNABIS = [
    "CGC", "TLRY", "CRON", "ACB", "OGI", "HEXO", "SNDL", "VFF",
    "GRWG", "SMG", "IIPR",
    "GTBIF", "CURLF", "TCNNF", "ACRDF", "CRLBF", "PLNHF",
    "HYFM", "SPRWF", "VRNOF", "ATTBF", "MRMD", "CBSTF",
    "FFNNF", "MNFSF", "CBDD", "VLNS", "KERN",
]

# Electric Vehicles & Clean Energy
CLEAN_ENERGY = [
    "PLUG", "FCEL", "BLDP", "BE", "ENPH", "SEDG", "RUN", "NOVA",
    "SPWR", "MAXN", "ARRY", "JKS", "DQ", "CSIQ", "FSLR", "GNRC",
    "TAN", "FAN", "ICLN", "QCLN", "PBW",
    "BEP", "CWEN", "AY", "NEP", "ORA", "AZRE", "NEXA",
    "HASI", "AMPS", "CLNE", "HYZON", "SUNW", "REGI", "AMRC",
    "SHLS", "STEM", "SLDP", "NRGV", "EVGO", "CHPT", "BLNK",
    "VLTA", "NUVL", "FLUX", "AMPX", "ALTM", "ITRI",
]

# Crypto-related
CRYPTO = [
    "MSTR", "MARA", "RIOT", "HUT", "BITF", "BTBT", "ARBK", "CLSK",
    "CIFR", "IREN", "GREE",
    "BKKT", "BTCS", "SATO", "HIVE", "DGHI", "LQDA", "BITQ", "SDIG",
    "COIN", "HOOD", "FRMO", "SI", "GBTC", "ETHE", "BITW",
    "CORZ", "WULF", "CAN", "BTDR", "BSRT",
]

# Chinese & Asian ADRs
SPECIAL = [
    "BABA", "JD", "PDD", "BIDU", "TME", "BILI", "IQ", "NTES",
    "EDU", "TAL", "GOTU", "ZTO", "VNET", "KC", "TUYA", "YY",
    "HUYA", "DOYU", "API", "DADA", "NIU",
    "FUTU", "UP", "LU", "WB", "XD", "LAIX", "CLFD", "LIAN",
    "CMGE", "CIFS", "FINV", "BTAI", "AMBO", "RECON", "CANG",
]

# International ADRs
INTERNATIONAL = [
    "TM", "SONY", "NVS", "AZN", "GSK", "SNY", "DEO", "UL", "BTI",
    "BP", "SHEL", "TTE", "EQNR", "E", "SAP", "SHOP", "SE", "GRAB",
    "CPNG", "MELI", "NU",
    "ABB", "NVO", "INFY", "WIT", "HDB", "IBN", "ITUB", "BBD",
    "ABEV", "ERIC", "NOK", "PHG", "LOGI", "NBIX", "SIE",
    "LYG", "BCS", "ING", "BBVA", "SAN", "RIO", "BHP", "VALE",
    "NTDOY", "SSNLF", "RHHBY", "NESN", "NOVOB",
]

# Small Cap Growth
SMALL_CAP = [
    "UPWK", "ASAN", "ZI", "PATH", "DV", "GTLB", "BRZE", "DOCN",
    "CRDO", "CWAN", "GH", "NARI", "EXAS", "RVMD", "RCKT", "PRTA",
    "AVTR", "TXG", "BEAM", "EDIT", "NTLA", "CRSP",
    "AGIO", "ARVN", "BPMC", "CDNA", "CCXI", "CRVS", "DICE",
    "DNLI", "ERAS", "HALO", "INTR", "KALA", "LYEL", "MIRM",
    "NBTX", "OCUL", "PHAT", "PRVB", "RCUS", "RLAY",
    "TGTX", "VRNA", "XNCR", "SAGE", "CODA", "BCYC", "BHVN",
    "BOLT", "BSGM", "CBAY", "CMRX", "FATE", "FOLD",
]

# Artificial Intelligence & Machine Learning
AI_ML = [
    "AI", "SOUN", "BBAI", "SYM", "PRCT", "AEYE", "MIND", "PERI",
    "GFAI", "IRBT", "CGNX", "DTSS", "BFLY", "CEVA",
    "NVDA", "MSFT", "GOOGL", "AMZN", "META", "IBM",
    "PLTR", "SNOW", "DDOG", "MDB", "CFLT", "NEWR",
    "OPRA", "OPEN", "LPSN", "STER", "RXRX",
]

# Insurance
INSURANCE = [
    "BRK-B", "AIG", "MET", "PRU", "AFL", "ALL", "CB", "TRV",
    "PGR", "HIG", "CINF", "GL", "UNM", "RLI", "WRB", "ERIE",
    "HMN", "KMPR", "THG", "HCI", "PLMR", "RYAN", "ACGL",
    "RNR", "MKL", "GLRE", "ARGO", "HRTG", "HIIG", "PIH",
    "STC", "WTM", "DGICA", "ESGR", "GBLI", "JRVR", "KINGSWAY",
    "NWLI", "OXBR", "QNST", "SHBI", "SNCY", "STKL", "UFG",
]

# Asset Management & Private Equity
ASSET_MANAGEMENT = [
    "BAM", "APO", "KKR", "BX", "CG", "OWL", "ARES", "BEN", "IVZ",
    "AMG", "EV", "VRTS", "HLNE", "STEP", "GCMG", "TPVG",
    "ROME", "PSEC", "GAIN", "MAIN", "ARCC", "FSLY", "OCSL",
    "ORCC", "GSBD", "BBDC", "TCPC", "SLRC", "PFLT", "NEWT",
    "HRZN", "HTGC", "CSWC", "FCRD", "NMFC", "TICC", "OFS",
]

# ETFs (Major sector & thematic)
ETFS = [
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "GLD", "SLV",
    "TLT", "HYG", "LQD", "EEM", "EFA", "VWO", "IEFA",
    "ARKK", "ARKG", "ARKQ", "ARKW", "ARKF",
    "XLK", "XLF", "XLV", "XLE", "XLI", "XLU", "XLRE",
    "XLC", "XLY", "XLP", "XLB",
    "VGT", "VHT", "VNQ", "VFH", "VDE", "VIS", "VAW", "VCR",
    "VDC", "VPU", "ICLN", "TAN", "FAN", "QCLN", "PBW",
    "GDX", "GDXJ", "SIL", "SILJ", "PPLT", "PALL",
    "BND", "BNDX", "EMB", "AGG", "MBB", "GOVT",
    "USO", "UNG", "PDBC", "COMT", "DBC",
]

# Space & Satellite Technology
SPACE = [
    "RKLB", "ASTR", "MNTS", "ASTS", "SPCE", "PL", "MAXR", "IRDM",
    "VSAT", "ATRO", "LILM", "JOBY", "ACHR", "EVEX", "BLADE",
    "ORBIT", "GNSS", "GILT", "SATL", "ORBK",
    "NSP", "KTOS", "HEI", "BWXT", "ERJ", "AMBP", "PRKS",
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
    SMALL_CAP +
    AI_ML +
    INSURANCE +
    ASSET_MANAGEMENT +
    ETFS +
    SPACE
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
    "ai_ml": AI_ML,
    "insurance": INSURANCE,
    "asset_management": ASSET_MANAGEMENT,
    "etfs": ETFS,
    "space": SPACE,
}

if __name__ == "__main__":
    print(f"Total unique tickers: {len(TICKERS)}")
    print(f"Categories: {len(TICKER_CATEGORIES)}")
    for category, tickers in TICKER_CATEGORIES.items():
        print(f"  {category}: {len(tickers)} tickers")
