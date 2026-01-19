#!/usr/bin/env python3
"""
Enhanced 2D Visualization Engine with Complex Multi-Panel Charts
Creates publication-quality charts with 16+ panels and advanced analysis
"""

import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import Rectangle, FancyBboxPatch, Circle
from matplotlib.collections import LineCollection
import matplotlib.dates as mdates
import pandas as pd
import numpy as np
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


class EnhancedVisualizer:
    """Create complex multi-panel visualization with advanced technical analysis"""
    
    def __init__(self, data, forecast_data, symbol):
        self.data = data
        self.forecast_data = forecast_data
        self.symbol = symbol
        self.fig = None
        
    def create_ultra_complex_chart(self, output_file):
        """Generate ultra-complex 16-panel chart"""
        
        # Create figure with complex grid layout
        fig = plt.figure(figsize=(28, 40))
        gs = gridspec.GridSpec(8, 4, figure=fig, hspace=0.4, wspace=0.3,
                              left=0.05, right=0.95, top=0.97, bottom=0.02)
        
        # Panel layout: 16 panels (8 rows x 4 columns for some, spans for others)
        axes = {
            'price_main': fig.add_subplot(gs[0:2, :]),  # Rows 0-1, all columns
            'volume': fig.add_subplot(gs[2, :]),         # Row 2, all columns
            'rsi_multi': fig.add_subplot(gs[3, 0:2]),   # Row 3, cols 0-1
            'macd_multi': fig.add_subplot(gs[3, 2:4]),  # Row 3, cols 2-3
            'stoch': fig.add_subplot(gs[4, 0:2]),       # Row 4, cols 0-1
            'williams_cci': fig.add_subplot(gs[4, 2:4]), # Row 4, cols 2-3
            'bollinger': fig.add_subplot(gs[5, 0:2]),   # Row 5, cols 0-1
            'atr_volatility': fig.add_subplot(gs[5, 2:4]), # Row 5, cols 2-3
            'volume_analysis': fig.add_subplot(gs[6, 0:2]), # Row 6, cols 0-1
            'momentum': fig.add_subplot(gs[6, 2:4]),    # Row 6, cols 2-3
            'option_flow': fig.add_subplot(gs[7, 0:2]), # Row 7, cols 0-1
            'risk_metrics': fig.add_subplot(gs[7, 2:4]) # Row 7, cols 2-3
        }
        
        self.fig = fig
        self.axes = axes
        
        # Plot each panel
        self._plot_enhanced_price(axes['price_main'])
        self._plot_volume_profile(axes['volume'])
        self._plot_multi_rsi(axes['rsi_multi'])
        self._plot_multi_macd(axes['macd_multi'])
        self._plot_stochastic_advanced(axes['stoch'])
        self._plot_williams_cci_combo(axes['williams_cci'])
        self._plot_bollinger_advanced(axes['bollinger'])
        self._plot_atr_volatility(axes['atr_volatility'])
        self._plot_volume_analysis(axes['volume_analysis'])
        self._plot_momentum_suite(axes['momentum'])
        self._plot_option_flow_proxy(axes['option_flow'])
        self._plot_risk_dashboard(axes['risk_metrics'])
        
        # Add title
        target_time = self.forecast_data.get('target_time', 'Unknown')
        current_price = self.data['Close'].iloc[-1]
        predicted_price = self.forecast_data.get('ml_forecast', {}).get('predicted_price', current_price)
        change_pct = ((predicted_price - current_price) / current_price) * 100
        
        fig.suptitle(f'{self.symbol} - Advanced GenAI Forecast | Target: {target_time}\n'
                    f'Current: ${current_price:.2f} → Forecast: ${predicted_price:.2f} ({change_pct:+.2f}%)',
                    fontsize=20, fontweight='bold', y=0.995)
        
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"Saved enhanced chart: {output_file}")
        
    def _plot_enhanced_price(self, ax):
        """Enhanced price chart with candlesticks, patterns, and multi-timeframe MAs"""
        df = self.data.copy()
        
        # Candlestick plot
        up = df[df['Close'] >= df['Open']]
        down = df[df['Close'] < df['Open']]
        
        width = 0.0003
        width2 = 0.00008
        
        # Up candles (green)
        ax.bar(up.index, up['Close'] - up['Open'], width, bottom=up['Open'],
               color='#26a69a', edgecolor='#26a69a', alpha=0.8, label='Up')
        ax.bar(up.index, up['High'] - up['Close'], width2, bottom=up['Close'],
               color='#26a69a', edgecolor='#26a69a', alpha=0.8)
        ax.bar(up.index, up['Low'] - up['Open'], width2, bottom=up['Open'],
               color='#26a69a', edgecolor='#26a69a', alpha=0.8)
        
        # Down candles (red)
        ax.bar(down.index, down['Close'] - down['Open'], width, bottom=down['Open'],
               color='#ef5350', edgecolor='#ef5350', alpha=0.8, label='Down')
        ax.bar(down.index, down['High'] - down['Open'], width2, bottom=down['Open'],
               color='#ef5350', edgecolor='#ef5350', alpha=0.8)
        ax.bar(down.index, down['Low'] - down['Close'], width2, bottom=down['Close'],
               color='#ef5350', edgecolor='#ef5350', alpha=0.8)
        
        # Multiple Moving Averages
        ma_config = [
            (5, '#FF6B6B', '-', 1.5),
            (9, '#4ECDC4', '-', 1.5),
            (20, '#45B7D1', '--', 2.0),
            (50, '#FFA07A', '--', 2.0),
            (100, '#98D8C8', '-.', 1.5),
            (200, '#FFD93D', '-.', 1.5)
        ]
        
        for period, color, style, width in ma_config:
            col = f'SMA_{period}'
            if col in df.columns:
                ax.plot(df.index, df[col], color=color, linestyle=style,
                       linewidth=width, label=f'SMA-{period}', alpha=0.7)
        
        # Bollinger Bands
        if 'BB_Upper_20' in df.columns:
            ax.fill_between(df.index, df['BB_Upper_20'], df['BB_Lower_20'],
                           alpha=0.15, color='purple', label='BB(20, 2σ)')
            ax.plot(df.index, df['BB_Upper_20'], 'purple', linewidth=1, alpha=0.5, linestyle='--')
            ax.plot(df.index, df['BB_Lower_20'], 'purple', linewidth=1, alpha=0.5, linestyle='--')
        
        # Support and Resistance levels
        patterns = self.forecast_data.get('pattern_analysis', {})
        if 'support_levels' in patterns:
            for level in patterns['support_levels'][:3]:
                ax.axhline(y=level, color='green', linestyle=':', linewidth=2, alpha=0.6)
                ax.text(df.index[-1], level, f'S: ${level:.2f}', 
                       fontsize=8, color='green', fontweight='bold',
                       bbox=dict(boxstyle='round', facecolor='white', alpha=0.7))
        
        if 'resistance_levels' in patterns:
            for level in patterns['resistance_levels'][:3]:
                ax.axhline(y=level, color='red', linestyle=':', linewidth=2, alpha=0.6)
                ax.text(df.index[-1], level, f'R: ${level:.2f}',
                       fontsize=8, color='red', fontweight='bold',
                       bbox=dict(boxstyle='round', facecolor='white', alpha=0.7))
        
        # Forecast point
        ml_forecast = self.forecast_data.get('ml_forecast', {})
        if 'predicted_price' in ml_forecast:
            pred_price = ml_forecast['predicted_price']
            ax.scatter([df.index[-1]], [pred_price], color='gold', s=300, 
                      marker='*', edgecolor='black', linewidth=2, zorder=10,
                      label=f'Forecast: ${pred_price:.2f}')
            
            # Confidence intervals
            if 'confidence_95_upper' in ml_forecast:
                ax.fill_between([df.index[-1], df.index[-1]], 
                               ml_forecast['confidence_95_lower'],
                               ml_forecast['confidence_95_upper'],
                               alpha=0.2, color='gold')
        
        # Detected patterns annotations
        if 'patterns_detected' in patterns:
            for i, pattern in enumerate(patterns['patterns_detected'][:5]):
                ax.text(0.02, 0.98 - (i * 0.04), f"• {pattern}", 
                       transform=ax.transAxes, fontsize=9,
                       bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.5),
                       verticalalignment='top')
        
        ax.set_ylabel('Price ($)', fontsize=12, fontweight='bold')
        ax.set_title('Price Action with Multi-Timeframe Analysis & Pattern Recognition',
                    fontsize=14, fontweight='bold', pad=10)
        ax.legend(loc='upper left', fontsize=8, ncol=4)
        ax.grid(True, alpha=0.3, linestyle='--')
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_volume_profile(self, ax):
        """Volume profile with price levels"""
        df = self.data.copy()
        
        # Volume bars colored by price change
        colors = ['#26a69a' if df['Close'].iloc[i] >= df['Open'].iloc[i] else '#ef5350' 
                  for i in range(len(df))]
        
        ax.bar(df.index, df['Volume'], width=0.0003, color=colors, alpha=0.7)
        
        # Volume moving averages
        if 'Volume_SMA_20' in df.columns:
            ax.plot(df.index, df['Volume_SMA_20'], 'orange', linewidth=2, 
                   label='Vol SMA-20', linestyle='--')
        
        # Highlight high volume bars
        volume_threshold = df['Volume'].quantile(0.9)
        high_vol = df[df['Volume'] > volume_threshold]
        ax.scatter(high_vol.index, high_vol['Volume'], color='red', s=50, 
                  marker='^', zorder=5, label='High Volume')
        
        ax.set_ylabel('Volume', fontsize=11, fontweight='bold')
        ax.set_title('Volume Profile & Flow Analysis', fontsize=13, fontweight='bold')
        ax.legend(loc='upper right', fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_multi_rsi(self, ax):
        """Multiple RSI timeframes"""
        df = self.data.copy()
        
        rsi_periods = [9, 14, 21]
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1']
        
        for i, period in enumerate(rsi_periods):
            col = f'RSI_{period}'
            if col in df.columns:
                ax.plot(df.index, df[col], color=colors[i], linewidth=2,
                       label=f'RSI-{period}', alpha=0.8)
        
        # Overbought/Oversold zones
        ax.axhline(y=70, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
        ax.axhline(y=30, color='green', linestyle='--', linewidth=1.5, alpha=0.7)
        ax.fill_between(df.index, 70, 100, alpha=0.1, color='red', label='Overbought')
        ax.fill_between(df.index, 0, 30, alpha=0.1, color='green', label='Oversold')
        
        # Midline
        ax.axhline(y=50, color='gray', linestyle=':', linewidth=1, alpha=0.5)
        
        ax.set_ylabel('RSI Value', fontsize=10, fontweight='bold')
        ax.set_title('Multi-Period RSI Analysis', fontsize=12, fontweight='bold')
        ax.set_ylim(0, 100)
        ax.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_multi_macd(self, ax):
        """Enhanced MACD with histogram coloring"""
        df = self.data.copy()
        
        if 'MACD_12_26' in df.columns:
            # MACD line
            ax.plot(df.index, df['MACD_12_26'], color='#2196F3', linewidth=2,
                   label='MACD(12,26)', alpha=0.9)
            
            # Signal line
            if 'MACD_Signal_12_26' in df.columns:
                ax.plot(df.index, df['MACD_Signal_12_26'], color='#FF9800',
                       linewidth=2, label='Signal(9)', alpha=0.9)
            
            # Histogram with color gradient
            if 'MACD_Hist_12_26' in df.columns:
                hist = df['MACD_Hist_12_26'].values
                colors = ['#26a69a' if h >= 0 else '#ef5350' for h in hist]
                ax.bar(df.index, df['MACD_Hist_12_26'], width=0.0003,
                      color=colors, alpha=0.5, label='Histogram')
            
            # Zero line
            ax.axhline(y=0, color='black', linestyle='-', linewidth=1, alpha=0.7)
            
            # Crossover signals
            if 'MACD_Signal_12_26' in df.columns:
                # Bullish crossover
                bullish = (df['MACD_12_26'] > df['MACD_Signal_12_26']) & \
                         (df['MACD_12_26'].shift(1) <= df['MACD_Signal_12_26'].shift(1))
                ax.scatter(df[bullish].index, df[bullish]['MACD_12_26'],
                          color='green', marker='^', s=100, zorder=5,
                          label='Bullish Cross')
                
                # Bearish crossover
                bearish = (df['MACD_12_26'] < df['MACD_Signal_12_26']) & \
                         (df['MACD_12_26'].shift(1) >= df['MACD_Signal_12_26'].shift(1))
                ax.scatter(df[bearish].index, df[bearish]['MACD_12_26'],
                          color='red', marker='v', s=100, zorder=5,
                          label='Bearish Cross')
        
        ax.set_ylabel('MACD Value', fontsize=10, fontweight='bold')
        ax.set_title('MACD with Divergence Detection', fontsize=12, fontweight='bold')
        ax.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_stochastic_advanced(self, ax):
        """Stochastic oscillator with %K and %D"""
        df = self.data.copy()
        
        if 'Stoch_K_14' in df.columns:
            ax.plot(df.index, df['Stoch_K_14'], color='#2196F3', linewidth=2,
                   label='%K(14)', alpha=0.9)
            
            if 'Stoch_D_14' in df.columns:
                ax.plot(df.index, df['Stoch_D_14'], color='#FF5722', linewidth=2,
                       label='%D(3)', alpha=0.9)
        
        # Overbought/Oversold
        ax.axhline(y=80, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
        ax.axhline(y=20, color='green', linestyle='--', linewidth=1.5, alpha=0.7)
        ax.fill_between(df.index, 80, 100, alpha=0.1, color='red')
        ax.fill_between(df.index, 0, 20, alpha=0.1, color='green')
        
        ax.set_ylabel('Stochastic (%)', fontsize=10, fontweight='bold')
        ax.set_title('Stochastic Oscillator with Momentum', fontsize=12, fontweight='bold')
        ax.set_ylim(0, 100)
        ax.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_williams_cci_combo(self, ax):
        """Williams %R and CCI combined"""
        df = self.data.copy()
        
        ax2 = ax.twinx()
        
        # Williams %R
        if 'Williams_R_14' in df.columns:
            ax.plot(df.index, df['Williams_R_14'], color='#9C27B0', linewidth=2,
                   label='Williams %R(14)', alpha=0.8)
            ax.axhline(y=-20, color='red', linestyle='--', linewidth=1, alpha=0.6)
            ax.axhline(y=-80, color='green', linestyle='--', linewidth=1, alpha=0.6)
            ax.set_ylabel('Williams %R', fontsize=10, fontweight='bold', color='#9C27B0')
            ax.set_ylim(-100, 0)
        
        # CCI
        if 'CCI_20' in df.columns:
            ax2.plot(df.index, df['CCI_20'], color='#FF9800', linewidth=2,
                    label='CCI(20)', alpha=0.8)
            ax2.axhline(y=100, color='red', linestyle=':', linewidth=1, alpha=0.6)
            ax2.axhline(y=-100, color='green', linestyle=':', linewidth=1, alpha=0.6)
            ax2.set_ylabel('CCI', fontsize=10, fontweight='bold', color='#FF9800')
        
        ax.set_title('Williams %R & CCI Momentum Indicators', fontsize=12, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8)
        ax2.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_bollinger_advanced(self, ax):
        """Bollinger Bands percentage and width"""
        df = self.data.copy()
        
        if 'BB_Position_20' in df.columns:
            # %B indicator
            ax.plot(df.index, df['BB_Position_20'] * 100, color='#673AB7',
                   linewidth=2, label='%B(20)', alpha=0.8)
            
            ax.axhline(y=100, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
            ax.axhline(y=0, color='green', linestyle='--', linewidth=1.5, alpha=0.7)
            ax.axhline(y=50, color='gray', linestyle=':', linewidth=1, alpha=0.5)
            
            # Squeeze zones
            ax.fill_between(df.index, 100, 150, alpha=0.1, color='red')
            ax.fill_between(df.index, -50, 0, alpha=0.1, color='green')
        
        # BB Width on secondary axis
        ax2 = ax.twinx()
        if 'BB_Width_20' in df.columns:
            ax2.plot(df.index, df['BB_Width_20'], color='orange', linewidth=2,
                    label='BB Width', alpha=0.6, linestyle='--')
            ax2.set_ylabel('BB Width (%)', fontsize=10, fontweight='bold', color='orange')
        
        ax.set_ylabel('%B Position (%)', fontsize=10, fontweight='bold', color='#673AB7')
        ax.set_title('Bollinger Bands %B & Width Analysis', fontsize=12, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8)
        ax2.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_atr_volatility(self, ax):
        """ATR and Historical Volatility"""
        df = self.data.copy()
        
        # ATR
        if 'ATR_14' in df.columns:
            ax.plot(df.index, df['ATR_14'], color='#F44336', linewidth=2,
                   label='ATR(14)', alpha=0.8)
        
        # Historical Volatility on secondary axis
        ax2 = ax.twinx()
        if 'HV_20' in df.columns:
            ax2.plot(df.index, df['HV_20'], color='#3F51B5', linewidth=2,
                    label='HV(20)', alpha=0.8, linestyle='--')
            ax2.set_ylabel('Historical Volatility (%)', fontsize=10, fontweight='bold', color='#3F51B5')
        
        ax.set_ylabel('ATR ($)', fontsize=10, fontweight='bold', color='#F44336')
        ax.set_title('Average True Range & Historical Volatility', fontsize=12, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8)
        ax2.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_volume_analysis(self, ax):
        """Advanced volume analysis with OBV and A/D"""
        df = self.data.copy()
        
        # OBV
        if 'OBV' in df.columns:
            obv_norm = (df['OBV'] - df['OBV'].min()) / (df['OBV'].max() - df['OBV'].min())
            ax.plot(df.index, obv_norm, color='#00BCD4', linewidth=2,
                   label='OBV (normalized)', alpha=0.8)
            
            if 'OBV_EMA' in df.columns:
                obv_ema_norm = (df['OBV_EMA'] - df['OBV'].min()) / (df['OBV'].max() - df['OBV'].min())
                ax.plot(df.index, obv_ema_norm, color='orange', linewidth=2,
                       label='OBV EMA', alpha=0.8, linestyle='--')
        
        # A/D on secondary axis
        ax2 = ax.twinx()
        if 'AD' in df.columns:
            ad_norm = (df['AD'] - df['AD'].min()) / (df['AD'].max() - df['AD'].min())
            ax2.plot(df.index, ad_norm, color='#E91E63', linewidth=2,
                    label='A/D (normalized)', alpha=0.8, linestyle='-.')
            ax2.set_ylabel('A/D Line', fontsize=10, fontweight='bold', color='#E91E63')
        
        ax.set_ylabel('OBV', fontsize=10, fontweight='bold', color='#00BCD4')
        ax.set_title('On-Balance Volume & Accumulation/Distribution', fontsize=12, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8)
        ax2.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_momentum_suite(self, ax):
        """Multiple momentum indicators"""
        df = self.data.copy()
        
        # Momentum indicators normalized
        indicators = []
        
        if 'Momentum_10' in df.columns:
            mom_norm = df['Momentum_10'] / df['Close']
            ax.plot(df.index, mom_norm * 100, color='#4CAF50', linewidth=2,
                   label='Momentum(10)', alpha=0.8)
        
        if 'CMO_14' in df.columns:
            ax.plot(df.index, df['CMO_14'], color='#FF9800', linewidth=2,
                   label='CMO(14)', alpha=0.8, linestyle='--')
        
        if 'Ultimate_Osc' in df.columns:
            # Normalize Ultimate Oscillator to similar scale
            ult_osc_scaled = (df['Ultimate_Osc'] - 50) * 2  # Convert from 0-100 to -100 to 100
            ax.plot(df.index, ult_osc_scaled, color='#9C27B0', linewidth=2,
                   label='Ultimate Osc', alpha=0.8, linestyle='-.')
        
        ax.axhline(y=0, color='black', linestyle='-', linewidth=1, alpha=0.7)
        ax.set_ylabel('Momentum Value', fontsize=10, fontweight='bold')
        ax.set_title('Momentum Indicators Suite', fontsize=12, fontweight='bold')
        ax.legend(loc='upper right', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_option_flow_proxy(self, ax):
        """Synthetic option flow analysis based on price/volume"""
        df = self.data.copy()
        
        # Calculate synthetic put/call flow based on price action and volume
        price_change = df['Close'].pct_change()
        volume_ratio = df['Volume'] / df['Volume'].rolling(20).mean()
        
        # Synthetic call flow (price up + high volume)
        call_flow = (price_change > 0) * volume_ratio * price_change * 1000
        put_flow = (price_change < 0) * volume_ratio * abs(price_change) * 1000
        
        # Cumulative flows
        cumulative_call = call_flow.fillna(0).cumsum()
        cumulative_put = put_flow.fillna(0).cumsum()
        
        ax.fill_between(df.index, cumulative_call, alpha=0.4, color='green',
                       label='Synthetic Call Flow')
        ax.fill_between(df.index, -cumulative_put, alpha=0.4, color='red',
                       label='Synthetic Put Flow')
        
        # Net flow
        net_flow = cumulative_call - cumulative_put
        ax.plot(df.index, net_flow, color='blue', linewidth=2.5,
               label='Net Flow', alpha=0.8)
        
        ax.axhline(y=0, color='black', linestyle='-', linewidth=1, alpha=0.7)
        ax.set_ylabel('Synthetic Flow', fontsize=10, fontweight='bold')
        ax.set_title('Options Flow Analysis (Synthetic Proxy)', fontsize=12, fontweight='bold')
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        
    def _plot_risk_dashboard(self, ax):
        """Risk metrics dashboard"""
        df = self.data.copy()
        
        # Calculate various risk metrics
        returns = df['Close'].pct_change()
        
        # Sharpe Ratio (annualized, assuming risk-free rate = 0.04)
        if len(returns) > 1:
            sharpe = (returns.mean() * 252 * 390 - 0.04) / (returns.std() * np.sqrt(252 * 390))
        else:
            sharpe = 0
        
        # Maximum Drawdown
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = drawdown.min()
        
        # Value at Risk (95%)
        var_95 = np.percentile(returns.dropna(), 5)
        
        # Current volatility (annualized)
        current_vol = returns.rolling(20).std().iloc[-1] * np.sqrt(252 * 390) * 100 if len(returns) > 20 else 0
        
        # Sortino Ratio (downside deviation)
        downside_returns = returns[returns < 0]
        if len(downside_returns) > 0:
            sortino = (returns.mean() * 252 * 390 - 0.04) / (downside_returns.std() * np.sqrt(252 * 390))
        else:
            sortino = sharpe
        
        # Create visualization
        metrics = {
            'Sharpe Ratio': sharpe,
            'Sortino Ratio': sortino,
            'Max Drawdown': max_drawdown * 100,
            'VaR (95%)': var_95 * 100,
            'Current Vol': current_vol
        }
        
        # Bar chart of risk metrics
        metric_names = list(metrics.keys())
        metric_values = list(metrics.values())
        
        colors_map = ['green' if v > 0 else 'red' for v in metric_values]
        
        bars = ax.barh(metric_names, metric_values, color=colors_map, alpha=0.7)
        
        # Add value labels
        for i, (name, value) in enumerate(metrics.items()):
            ax.text(value, i, f'  {value:.2f}', va='center', fontsize=10, fontweight='bold')
        
        ax.axvline(x=0, color='black', linestyle='-', linewidth=1, alpha=0.7)
        ax.set_xlabel('Metric Value', fontsize=10, fontweight='bold')
        ax.set_title('Risk Metrics Dashboard', fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='x')


def enhance_charts(forecast_file='forecast_monday_1pm.json'):
    """Create enhanced charts for all symbols"""
    import json
    
    print("\n" + "="*80)
    print("GENERATING ENHANCED CHARTS")
    print("="*80 + "\n")
    
    with open(forecast_file, 'r') as f:
        forecasts = json.load(f)
    
    for symbol, forecast_data in forecasts.items():
        try:
            print(f"Creating enhanced chart for {symbol}...")
            
            # Get data
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="5d", interval="1m")
            
            # Calculate indicators
            from genai_forecaster import MarketForecaster
            forecaster = MarketForecaster(symbol)
            forecaster.data = data
            forecaster.calculate_advanced_indicators()
            
            # Create visualization
            visualizer = EnhancedVisualizer(forecaster.data, forecast_data, symbol)
            output_file = f"forecast_{symbol.replace('^', '')}_enhanced_chart.png"
            visualizer.create_ultra_complex_chart(output_file)
            
            print(f"✓ Enhanced chart saved: {output_file}")
            
        except Exception as e:
            print(f"Error creating chart for {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*80)
    print("CHART ENHANCEMENT COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    import yfinance as yf
    enhance_charts()
