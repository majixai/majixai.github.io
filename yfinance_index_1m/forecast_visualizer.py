#!/usr/bin/env python3
"""
Advanced Chart Visualization System
Creates complex, publication-quality charts with pattern overlays, indicators, and forecasts
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Rectangle, FancyBboxPatch
import matplotlib.dates as mdates
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import warnings
warnings.filterwarnings('ignore')


class ForecastVisualizer:
    """Create comprehensive visualization for market forecasts"""
    
    def __init__(self, forecast_data):
        self.forecast = forecast_data
        self.symbol = forecast_data['symbol']
        self.fig = None
        self.axes = []
        
    def create_comprehensive_chart(self, data, output_file='forecast_chart.png'):
        """Create multi-panel comprehensive chart"""
        
        # Create figure with multiple subplots
        fig = plt.figure(figsize=(20, 24))
        gs = fig.add_gridspec(6, 2, hspace=0.3, wspace=0.3)
        
        # Main price chart with patterns (large, spans both columns)
        ax1 = fig.add_subplot(gs[0:2, :])
        
        # Volume chart
        ax2 = fig.add_subplot(gs[2, :], sharex=ax1)
        
        # RSI
        ax3 = fig.add_subplot(gs[3, 0])
        
        # MACD
        ax4 = fig.add_subplot(gs[3, 1])
        
        # Stochastic
        ax5 = fig.add_subplot(gs[4, 0])
        
        # Bollinger Bands %
        ax6 = fig.add_subplot(gs[4, 1])
        
        # Williams %R and CCI
        ax7 = fig.add_subplot(gs[5, 0])
        
        # Option strategies visualization
        ax8 = fig.add_subplot(gs[5, 1])
        
        self.axes = [ax1, ax2, ax3, ax4, ax5, ax6, ax7, ax8]
        
        # Plot each component
        self._plot_price_with_patterns(ax1, data)
        self._plot_volume(ax2, data)
        self._plot_rsi(ax3, data)
        self._plot_macd(ax4, data)
        self._plot_stochastic(ax5, data)
        self._plot_bollinger_percent(ax6, data)
        self._plot_williams_cci(ax7, data)
        self._plot_option_strategies(ax8)
        
        # Add overall title
        symbol_name = "S&P 500" if self.symbol == "^GSPC" else "Dow Jones Industrial Average"
        sentiment = self.forecast['market_sentiment']['overall']
        fig.suptitle(f'{symbol_name} ({self.symbol}) - Comprehensive Forecast Analysis\n'
                    f'Sentiment: {sentiment} | Target: Monday 1 PM Close',
                    fontsize=20, fontweight='bold', y=0.995)
        
        # Save figure
        plt.savefig(output_file, dpi=300, bbox_inches='tight', facecolor='white')
        print(f"Chart saved to {output_file}")
        
        return fig
    
    def _plot_price_with_patterns(self, ax, data):
        """Plot main price chart with all overlays"""
        
        df = data.copy()
        if 'Datetime' not in df.columns and not isinstance(df.index, pd.DatetimeIndex):
            df['Datetime'] = pd.to_datetime(df.index)
        else:
            df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        # Plot candlesticks (using OHLC bars)
        for idx in range(len(df)):
            row = df.iloc[idx]
            color = 'green' if row['Close'] > row['Open'] else 'red'
            alpha = 0.6
            
            # High-Low line
            ax.plot([row['Datetime'], row['Datetime']], 
                   [row['Low'], row['High']], 
                   color=color, linewidth=0.5, alpha=alpha)
            
            # Open-Close body
            height = abs(row['Close'] - row['Open'])
            bottom = min(row['Open'], row['Close'])
            ax.add_patch(Rectangle((mdates.date2num(row['Datetime']) - 0.0002, bottom),
                                   0.0004, height, facecolor=color, alpha=alpha, edgecolor=color))
        
        # Plot moving averages
        ax.plot(df['Datetime'], df['SMA_20'], label='SMA 20', color='blue', linewidth=1.5, alpha=0.7)
        ax.plot(df['Datetime'], df['SMA_50'], label='SMA 50', color='orange', linewidth=1.5, alpha=0.7)
        ax.plot(df['Datetime'], df['EMA_12'], label='EMA 12', color='purple', linewidth=1, alpha=0.6, linestyle='--')
        ax.plot(df['Datetime'], df['EMA_26'], label='EMA 26', color='brown', linewidth=1, alpha=0.6, linestyle='--')
        
        # Plot Bollinger Bands
        ax.plot(df['Datetime'], df['BB_Upper'], label='BB Upper', color='gray', linewidth=1, alpha=0.5, linestyle=':')
        ax.plot(df['Datetime'], df['BB_Lower'], label='BB Lower', color='gray', linewidth=1, alpha=0.5, linestyle=':')
        ax.fill_between(df['Datetime'], df['BB_Upper'], df['BB_Lower'], alpha=0.1, color='gray')
        
        # Add pattern overlays
        self._add_pattern_overlays(ax, df)
        
        # Add support/resistance levels
        self._add_support_resistance(ax, df)
        
        # Add Fibonacci levels
        self._add_fibonacci_levels(ax, df)
        
        # Add forecast point
        self._add_forecast_point(ax, df)
        
        ax.set_ylabel('Price ($)', fontsize=12, fontweight='bold')
        ax.set_title('Price Action with Patterns & Indicators', fontsize=14, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8, ncol=3)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _add_pattern_overlays(self, ax, df):
        """Add visual overlays for detected patterns"""
        patterns = self.forecast['patterns_detected']
        
        # Head and Shoulders
        if patterns.get('head_and_shoulders', {}).get('detected'):
            hs = patterns['head_and_shoulders']
            neckline = hs.get('neckline')
            if neckline:
                ax.axhline(y=neckline, color='red', linestyle='--', linewidth=2, 
                          label=f'H&S Neckline: ${neckline:.2f}', alpha=0.7)
                ax.text(df['Datetime'].iloc[-1], neckline, ' Head & Shoulders', 
                       color='red', fontsize=9, fontweight='bold')
        
        # Triangle patterns
        if patterns.get('triangle', {}).get('detected'):
            tri = patterns['triangle']
            tri_type = tri.get('type', 'symmetrical')
            ax.text(df['Datetime'].iloc[-20], df['Close'].iloc[-20], 
                   f'{tri_type.title()} Triangle', 
                   bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.5),
                   fontsize=9, fontweight='bold')
        
        # Flag pattern
        if patterns.get('flag', {}).get('detected'):
            flag = patterns['flag']
            flag_type = flag.get('type', 'neutral')
            ax.text(df['Datetime'].iloc[-15], df['Close'].iloc[-15], 
                   f'{flag_type.title()} Flag', 
                   bbox=dict(boxstyle='round', facecolor='cyan', alpha=0.5),
                   fontsize=9, fontweight='bold')
        
        # Cup and Handle
        if patterns.get('cup_and_handle', {}).get('detected'):
            cup = patterns['cup_and_handle']
            rim = cup.get('rim')
            if rim:
                ax.axhline(y=rim, color='green', linestyle='-.', linewidth=2, 
                          label=f'Cup Rim: ${rim:.2f}', alpha=0.6)
    
    def _add_support_resistance(self, ax, df):
        """Add support and resistance levels"""
        sr = self.forecast['patterns_detected'].get('support_resistance', {})
        
        if sr.get('detected'):
            nearest_res = sr.get('nearest_resistance', [])
            nearest_sup = sr.get('nearest_support', [])
            
            # Plot nearest resistance levels
            for i, res in enumerate(nearest_res[:2]):
                ax.axhline(y=res, color='red', linestyle='--', linewidth=1.5, 
                          alpha=0.6, label=f'Resistance {i+1}: ${res:.2f}' if i == 0 else '')
                ax.text(df['Datetime'].iloc[len(df)//2], res, f' R{i+1}', 
                       color='red', fontsize=8, fontweight='bold')
            
            # Plot nearest support levels
            for i, sup in enumerate(nearest_sup[:2]):
                ax.axhline(y=sup, color='green', linestyle='--', linewidth=1.5, 
                          alpha=0.6, label=f'Support {i+1}: ${sup:.2f}' if i == 0 else '')
                ax.text(df['Datetime'].iloc[len(df)//2], sup, f' S{i+1}', 
                       color='green', fontsize=8, fontweight='bold')
    
    def _add_fibonacci_levels(self, ax, df):
        """Add Fibonacci retracement levels"""
        fib = self.forecast['patterns_detected'].get('fibonacci_levels', {})
        
        if fib.get('detected'):
            levels = [
                (fib.get('level_236'), '23.6%', 'blue'),
                (fib.get('level_382'), '38.2%', 'purple'),
                (fib.get('level_500'), '50%', 'orange'),
                (fib.get('level_618'), '61.8%', 'red'),
            ]
            
            for level, label, color in levels:
                if level:
                    ax.axhline(y=level, color=color, linestyle=':', linewidth=1, alpha=0.4)
                    ax.text(df['Datetime'].iloc[-1], level, f' Fib {label}', 
                           color=color, fontsize=7, alpha=0.7)
    
    def _add_forecast_point(self, ax, df):
        """Add ML forecast point"""
        ml_forecast = self.forecast.get('ml_forecast', {})
        predicted_price = ml_forecast.get('predicted_price')
        
        if predicted_price:
            # Add forecast point to the right of current data
            last_time = df['Datetime'].iloc[-1]
            forecast_time = last_time + timedelta(hours=24)  # Monday 1 PM
            
            # Draw forecast point
            ax.scatter([forecast_time], [predicted_price], color='gold', s=200, 
                      marker='*', edgecolors='black', linewidths=2, 
                      label=f'ML Forecast: ${predicted_price:.2f}', zorder=5)
            
            # Draw confidence interval
            upper_95 = ml_forecast.get('confidence_95_upper')
            lower_95 = ml_forecast.get('confidence_95_lower')
            
            if upper_95 and lower_95:
                # Vertical line for confidence interval
                ax.plot([forecast_time, forecast_time], [lower_95, upper_95], 
                       color='gold', linewidth=3, alpha=0.5)
                
                # Horizontal bars
                ax.plot([forecast_time - timedelta(minutes=30), forecast_time + timedelta(minutes=30)], 
                       [upper_95, upper_95], color='gold', linewidth=2, alpha=0.5)
                ax.plot([forecast_time - timedelta(minutes=30), forecast_time + timedelta(minutes=30)], 
                       [lower_95, lower_95], color='gold', linewidth=2, alpha=0.5)
                
                # Label
                ax.text(forecast_time, predicted_price, f'\nMonday 1PM\n${predicted_price:.2f}', 
                       ha='center', va='bottom', fontsize=10, fontweight='bold',
                       bbox=dict(boxstyle='round', facecolor='gold', alpha=0.7))
    
    def _plot_volume(self, ax, data):
        """Plot volume with analysis"""
        df = data.copy()
        df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        # Color volume bars by price direction
        colors = ['green' if df.iloc[i]['Close'] > df.iloc[i]['Open'] else 'red' 
                 for i in range(len(df))]
        
        ax.bar(df['Datetime'], df['Volume'], color=colors, alpha=0.6, width=0.0008)
        ax.plot(df['Datetime'], df['Volume_SMA'], color='blue', linewidth=2, 
               label='Volume SMA', alpha=0.7)
        
        ax.set_ylabel('Volume', fontsize=12, fontweight='bold')
        ax.set_title('Volume Analysis', fontsize=14, fontweight='bold')
        ax.legend(loc='upper left', fontsize=10)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _plot_rsi(self, ax, data):
        """Plot RSI with zones"""
        df = data.copy()
        df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        ax.plot(df['Datetime'], df['RSI'], color='blue', linewidth=2)
        ax.axhline(y=70, color='red', linestyle='--', linewidth=1, alpha=0.7, label='Overbought (70)')
        ax.axhline(y=30, color='green', linestyle='--', linewidth=1, alpha=0.7, label='Oversold (30)')
        ax.axhline(y=50, color='gray', linestyle=':', linewidth=1, alpha=0.5)
        
        # Fill zones
        ax.fill_between(df['Datetime'], 70, 100, alpha=0.2, color='red')
        ax.fill_between(df['Datetime'], 0, 30, alpha=0.2, color='green')
        
        # Current value
        current_rsi = df['RSI'].iloc[-1]
        ax.text(df['Datetime'].iloc[-1], current_rsi, f' {current_rsi:.1f}', 
               fontsize=10, fontweight='bold', va='center')
        
        ax.set_ylabel('RSI', fontsize=11, fontweight='bold')
        ax.set_title('Relative Strength Index', fontsize=12, fontweight='bold')
        ax.set_ylim(0, 100)
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _plot_macd(self, ax, data):
        """Plot MACD with signal and histogram"""
        df = data.copy()
        df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        ax.plot(df['Datetime'], df['MACD'], color='blue', linewidth=2, label='MACD')
        ax.plot(df['Datetime'], df['MACD_Signal'], color='red', linewidth=2, label='Signal')
        
        # Histogram
        colors = ['green' if val > 0 else 'red' for val in df['MACD_Histogram']]
        ax.bar(df['Datetime'], df['MACD_Histogram'], color=colors, alpha=0.3, 
              width=0.0008, label='Histogram')
        
        ax.axhline(y=0, color='black', linestyle='-', linewidth=0.5)
        ax.set_ylabel('MACD', fontsize=11, fontweight='bold')
        ax.set_title('MACD (Moving Average Convergence Divergence)', fontsize=12, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _plot_stochastic(self, ax, data):
        """Plot Stochastic Oscillator"""
        df = data.copy()
        df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        ax.plot(df['Datetime'], df['Stochastic_K'], color='blue', linewidth=2, label='%K')
        ax.plot(df['Datetime'], df['Stochastic_D'], color='red', linewidth=2, label='%D')
        
        ax.axhline(y=80, color='red', linestyle='--', linewidth=1, alpha=0.7)
        ax.axhline(y=20, color='green', linestyle='--', linewidth=1, alpha=0.7)
        
        ax.fill_between(df['Datetime'], 80, 100, alpha=0.2, color='red')
        ax.fill_between(df['Datetime'], 0, 20, alpha=0.2, color='green')
        
        ax.set_ylabel('Stochastic', fontsize=11, fontweight='bold')
        ax.set_title('Stochastic Oscillator', fontsize=12, fontweight='bold')
        ax.set_ylim(0, 100)
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _plot_bollinger_percent(self, ax, data):
        """Plot Bollinger Band percentage position"""
        df = data.copy()
        df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        # Calculate %B (position within Bollinger Bands)
        df['BB_Percent'] = (df['Close'] - df['BB_Lower']) / (df['BB_Upper'] - df['BB_Lower']) * 100
        
        ax.plot(df['Datetime'], df['BB_Percent'], color='purple', linewidth=2)
        ax.axhline(y=100, color='red', linestyle='--', linewidth=1, alpha=0.7)
        ax.axhline(y=0, color='green', linestyle='--', linewidth=1, alpha=0.7)
        ax.axhline(y=50, color='gray', linestyle=':', linewidth=1, alpha=0.5)
        
        ax.fill_between(df['Datetime'], 100, 150, alpha=0.2, color='red')
        ax.fill_between(df['Datetime'], 0, -50, alpha=0.2, color='green')
        
        ax.set_ylabel('%B', fontsize=11, fontweight='bold')
        ax.set_title('Bollinger Band %B', fontsize=12, fontweight='bold')
        ax.legend(['%B', 'Upper Band', 'Lower Band'], loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _plot_williams_cci(self, ax, data):
        """Plot Williams %R and CCI"""
        df = data.copy()
        df['Datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else df['Datetime'])
        
        ax2 = ax.twinx()
        
        # Williams %R
        ax.plot(df['Datetime'], df['Williams_R'], color='blue', linewidth=2, label='Williams %R')
        ax.axhline(y=-20, color='red', linestyle='--', linewidth=1, alpha=0.5)
        ax.axhline(y=-80, color='green', linestyle='--', linewidth=1, alpha=0.5)
        ax.fill_between(df['Datetime'], -20, 0, alpha=0.2, color='red')
        ax.fill_between(df['Datetime'], -100, -80, alpha=0.2, color='green')
        
        # CCI on secondary axis
        ax2.plot(df['Datetime'], df['CCI'], color='orange', linewidth=2, label='CCI', alpha=0.7)
        ax2.axhline(y=100, color='red', linestyle=':', linewidth=1, alpha=0.5)
        ax2.axhline(y=-100, color='green', linestyle=':', linewidth=1, alpha=0.5)
        
        ax.set_ylabel('Williams %R', fontsize=11, fontweight='bold', color='blue')
        ax2.set_ylabel('CCI', fontsize=11, fontweight='bold', color='orange')
        ax.set_title('Williams %R and Commodity Channel Index', fontsize=12, fontweight='bold')
        
        ax.legend(loc='upper left', fontsize=8)
        ax2.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    def _plot_option_strategies(self, ax):
        """Visualize recommended option strategies"""
        strategies = self.forecast.get('option_strategies', {}).get('recommended_strategies', [])
        
        if not strategies:
            ax.text(0.5, 0.5, 'No option strategies available', 
                   ha='center', va='center', fontsize=12)
            ax.axis('off')
            return
        
        # Clear axis
        ax.clear()
        ax.axis('off')
        
        # Title
        ax.text(0.5, 0.95, 'Recommended Option Strategies', 
               ha='center', va='top', fontsize=14, fontweight='bold',
               transform=ax.transAxes)
        
        # Display top 3 strategies
        y_pos = 0.85
        for i, strategy in enumerate(strategies[:3]):
            # Strategy box
            box_color = 'lightgreen' if 'BULL' in strategy['type'] else 'lightcoral' if 'BEAR' in strategy['type'] else 'lightyellow'
            
            # Strategy name and type
            ax.text(0.05, y_pos, f"{i+1}. {strategy['name']}", 
                   ha='left', va='top', fontsize=11, fontweight='bold',
                   transform=ax.transAxes,
                   bbox=dict(boxstyle='round', facecolor=box_color, alpha=0.7))
            
            y_pos -= 0.05
            
            # Description
            ax.text(0.05, y_pos, f"   {strategy['description']}", 
                   ha='left', va='top', fontsize=9,
                   transform=ax.transAxes, wrap=True)
            
            y_pos -= 0.04
            
            # Key details
            ax.text(0.05, y_pos, f"   Risk: {strategy['risk_level']} | "
                   f"Capital: {strategy['capital_required']}", 
                   ha='left', va='top', fontsize=8, style='italic',
                   transform=ax.transAxes)
            
            y_pos -= 0.05
            
            # Max profit/loss
            ax.text(0.05, y_pos, f"   Max Profit: {strategy['max_profit']}", 
                   ha='left', va='top', fontsize=8, color='green',
                   transform=ax.transAxes)
            
            y_pos -= 0.03
            
            ax.text(0.05, y_pos, f"   Max Loss: {strategy['max_loss']}", 
                   ha='left', va='top', fontsize=8, color='red',
                   transform=ax.transAxes)
            
            y_pos -= 0.08
            
            if y_pos < 0.1:
                break
        
        # Add disclaimer
        ax.text(0.5, 0.02, 'Options trading involves substantial risk. Past performance does not guarantee future results.', 
               ha='center', va='bottom', fontsize=7, style='italic', color='gray',
               transform=ax.transAxes)


def create_all_visualizations(forecast_file='forecast_monday_1pm.json'):
    """Create all visualizations from forecast data"""
    
    print("\n" + "="*80)
    print("CREATING COMPREHENSIVE VISUALIZATIONS")
    print("="*80 + "\n")
    
    # Load forecast data
    with open(forecast_file, 'r') as f:
        all_forecasts = json.load(f)
    
    for symbol, forecast_data in all_forecasts.items():
        print(f"\nCreating visualization for {symbol}...")
        
        try:
            # Create visualizer
            visualizer = ForecastVisualizer(forecast_data)
            
            # Need to recreate data for visualization
            # Load from original forecast or refetch
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="5d", interval="1m")
            
            if data.empty:
                print(f"No data available for {symbol}")
                continue
            
            # Recalculate indicators (simplified version)
            data['SMA_20'] = data['Close'].rolling(window=20).mean()
            data['SMA_50'] = data['Close'].rolling(window=50).mean()
            data['EMA_12'] = data['Close'].ewm(span=12, adjust=False).mean()
            data['EMA_26'] = data['Close'].ewm(span=26, adjust=False).mean()
            
            # MACD
            data['MACD'] = data['EMA_12'] - data['EMA_26']
            data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
            data['MACD_Histogram'] = data['MACD'] - data['MACD_Signal']
            
            # RSI
            delta = data['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            data['RSI'] = 100 - (100 / (1 + rs))
            
            # Bollinger Bands
            data['BB_Middle'] = data['Close'].rolling(window=20).mean()
            data['BB_Std'] = data['Close'].rolling(window=20).std()
            data['BB_Upper'] = data['BB_Middle'] + (data['BB_Std'] * 2)
            data['BB_Lower'] = data['BB_Middle'] - (data['BB_Std'] * 2)
            
            # Stochastic
            low_min = data['Low'].rolling(window=14).min()
            high_max = data['High'].rolling(window=14).max()
            data['Stochastic_K'] = 100 * ((data['Close'] - low_min) / (high_max - low_min))
            data['Stochastic_D'] = data['Stochastic_K'].rolling(window=3).mean()
            
            # Williams %R
            data['Williams_R'] = -100 * ((high_max - data['Close']) / (high_max - low_min))
            
            # CCI
            tp = (data['High'] + data['Low'] + data['Close']) / 3
            data['CCI'] = (tp - tp.rolling(20).mean()) / (0.015 * tp.rolling(20).std())
            
            # Volume
            data['Volume_SMA'] = data['Volume'].rolling(window=20).mean()
            
            # Create chart
            output_file = f'forecast_{symbol.replace("^", "")}_chart.png'
            visualizer.create_comprehensive_chart(data, output_file)
            
            print(f"✓ Visualization created: {output_file}")
            
        except Exception as e:
            print(f"Error creating visualization for {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*80)
    print("VISUALIZATION GENERATION COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    create_all_visualizations()
