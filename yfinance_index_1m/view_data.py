#!/usr/bin/env python3
"""
Quick Data Viewer - Display stored YFinance data
"""

import json
import sys
from datetime import datetime

def format_number(num, decimals=2):
    """Format number with commas"""
    return f"{num:,.{decimals}f}"

def print_summary():
    """Print a summary of all stored data"""
    try:
        with open('index_1m.json', 'r') as f:
            data = json.load(f)
        
        print("╔" + "═" * 78 + "╗")
        print("║" + " " * 20 + "YFINANCE MARKET DATA SUMMARY" + " " * 30 + "║")
        print("╠" + "═" * 78 + "╣")
        
        index_names = {
            '^GSPC': 'S&P 500',
            '^DJI': 'Dow Jones',
            '^IXIC': 'NASDAQ',
            '^RUT': 'Russell 2000',
            '^VIX': 'VIX',
            '^TNX': '10-Yr Treasury',
            '^FTSE': 'FTSE 100',
            '^GDAXI': 'DAX',
            '^N225': 'Nikkei 225',
            '^HSI': 'Hang Seng'
        }
        
        priority = ['^DJI', '^GSPC', '^IXIC', '^RUT', '^VIX']
        
        for symbol in priority:
            if symbol in data and 'data' in data[symbol]:
                print_index_card(symbol, data[symbol], index_names.get(symbol, symbol))
                print("╠" + "═" * 78 + "╣")
        
        print("║" + " " * 78 + "║")
        print(f"║  Total Indices: {len(data):<10} | Dashboard: dashboard.html" + " " * 28 + "║")
        print("╚" + "═" * 78 + "╝")
        
    except FileNotFoundError:
        print("❌ Error: index_1m.json not found")
        print("Run: python3 fetch_data.py or python3 update_data.py")
    except Exception as e:
        print(f"❌ Error: {e}")

def print_index_card(symbol, index_data, name):
    """Print formatted card for an index"""
    records = index_data['data']
    latest = records[-1]
    first = records[0]
    
    # Calculate metrics
    current_price = latest['Close']
    open_price = first['Open']
    high = max(r['High'] for r in records)
    low = min(r['Low'] for r in records)
    change = current_price - open_price
    change_pct = (change / open_price) * 100
    volume = sum(r['Volume'] for r in records)
    
    # Status indicator
    status = "▲" if change > 0 else "▼"
    color_code = "🟢" if change > 0 else "🔴"
    
    # Print card
    print(f"║  {symbol:<8} {name:<40} {color_code}          ║")
    print(f"║  Price: ${format_number(current_price, 2):>12}  {status} ${abs(change):>8.2f} ({change_pct:>+6.2f}%)      ║")
    print(f"║  Open: ${format_number(open_price, 2):>12}  High: ${format_number(high, 2):>12}  Low: ${format_number(low, 2):>12}  ║")
    print(f"║  Volume: {format_volume(volume):>10}  RSI: {latest['RSI']:>6.1f}  MACD: {latest['MACD']:>8.3f}  Vol: {latest['Volatility']*100:>5.2f}%  ║")
    print(f"║  Data Points: {len(records):<8} Updated: {index_data.get('last_update', 'N/A')[:19]:<25}  ║")

def format_volume(vol):
    """Format volume with B/M/K suffix"""
    if vol >= 1e9:
        return f"{vol/1e9:.2f}B"
    elif vol >= 1e6:
        return f"{vol/1e6:.2f}M"
    elif vol >= 1e3:
        return f"{vol/1e3:.2f}K"
    return str(vol)

def print_detailed(symbol):
    """Print detailed information for a specific index"""
    try:
        with open('index_1m.json', 'r') as f:
            data = json.load(f)
        
        if symbol not in data:
            print(f"❌ Symbol {symbol} not found in data")
            print(f"Available: {', '.join(data.keys())}")
            return
        
        index_data = data[symbol]
        records = index_data['data']
        
        print("\n" + "=" * 80)
        print(f"DETAILED VIEW: {symbol}")
        print("=" * 80)
        
        print(f"\nTotal Records: {len(records)}")
        print(f"Last Update: {index_data.get('last_update', 'N/A')}")
        
        print("\n📊 Recent Price Action (Last 10 minutes):")
        print("-" * 80)
        print(f"{'Time':<20} {'Open':>10} {'High':>10} {'Low':>10} {'Close':>10} {'Volume':>12}")
        print("-" * 80)
        
        for record in records[-10:]:
            date_str = record['Date'][:19] if len(record['Date']) > 19 else record['Date']
            print(f"{date_str:<20} "
                  f"${record['Open']:>9.2f} "
                  f"${record['High']:>9.2f} "
                  f"${record['Low']:>9.2f} "
                  f"${record['Close']:>9.2f} "
                  f"{record['Volume']:>12,}")
        
        # Latest indicators
        latest = records[-1]
        print("\n📈 Technical Indicators (Latest):")
        print("-" * 80)
        print(f"RSI: {latest['RSI']:.2f}")
        print(f"MACD: {latest['MACD']:.4f} | Signal: {latest['MACD_Signal']:.4f} | Hist: {latest['MACD_Hist']:.4f}")
        print(f"Stochastic K: {latest['Stoch_K']:.2f} | D: {latest['Stoch_D']:.2f}")
        print(f"Volatility: {latest['Volatility']*100:.2f}%")
        print(f"SMA 20: ${latest['SMA_20']:.2f} | SMA 50: ${latest['SMA_50']:.2f}")
        print(f"EMA 12: ${latest['EMA_12']:.2f} | EMA 26: ${latest['EMA_26']:.2f}")
        print(f"Bollinger Bands: Upper ${latest['BB_Upper']:.2f} | Middle ${latest['BB_Middle']:.2f} | Lower ${latest['BB_Lower']:.2f}")
        print("=" * 80 + "\n")
        
    except FileNotFoundError:
        print("❌ Error: index_1m.json not found")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    if len(sys.argv) > 1:
        symbol = sys.argv[1].upper()
        if not symbol.startswith('^'):
            symbol = '^' + symbol
        print_detailed(symbol)
    else:
        print_summary()

if __name__ == "__main__":
    main()
