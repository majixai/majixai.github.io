#!/usr/bin/env python3
"""
Advanced 3D Visualization Engine with Interactive Charts
Provides sophisticated multi-dimensional analysis and visualization
"""

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
import pandas as pd
import numpy as np
from scipy import stats
from scipy.interpolate import griddata
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')


class Advanced3DVisualizer:
    """Create advanced 3D interactive visualizations"""
    
    def __init__(self, forecast_data):
        self.forecast = forecast_data
        self.symbol = forecast_data['symbol']
        self.data = None
        
    def create_comprehensive_3d_dashboard(self, data, output_file='forecast_3d_interactive.html'):
        """Create comprehensive interactive 3D dashboard"""
        
        self.data = data
        
        # Create figure with subplots
        fig = make_subplots(
            rows=4, cols=3,
            subplot_titles=(
                'Price Action with Volume (3D)', 'Volatility Surface', 'Correlation Heatmap',
                'Technical Indicators (3D)', 'Price-Volume-Time Surface', 'Option Greeks Surface',
                'Pattern Recognition (3D Space)', 'Monte Carlo Simulations', 'Market Sentiment Evolution',
                'Support/Resistance Levels (3D)', 'Candlestick with Volume Profile', 'Risk Metrics Dashboard'
            ),
            specs=[
                [{'type': 'scatter3d'}, {'type': 'surface'}, {'type': 'heatmap'}],
                [{'type': 'scatter3d'}, {'type': 'surface'}, {'type': 'surface'}],
                [{'type': 'scatter3d'}, {'type': 'scatter3d'}, {'type': 'scatter3d'}],
                [{'type': 'scatter3d'}, {'type': 'candlestick', 'secondary_y': True}, {'type': 'indicator'}]
            ],
            vertical_spacing=0.08,
            horizontal_spacing=0.06,
            row_heights=[0.25, 0.25, 0.25, 0.25]
        )
        
        # Add all visualizations
        self._add_3d_price_volume(fig, data, row=1, col=1)
        self._add_volatility_surface(fig, data, row=1, col=2)
        self._add_correlation_heatmap(fig, data, row=1, col=3)
        self._add_3d_technical_indicators(fig, data, row=2, col=1)
        self._add_price_volume_time_surface(fig, data, row=2, col=2)
        self._add_option_greeks_surface(fig, data, row=2, col=3)
        self._add_3d_pattern_recognition(fig, data, row=3, col=1)
        self._add_monte_carlo_paths(fig, data, row=3, col=2)
        self._add_sentiment_evolution(fig, data, row=3, col=3)
        self._add_3d_support_resistance(fig, data, row=4, col=1)
        self._add_candlestick_volume_profile(fig, data, row=4, col=2)
        self._add_risk_dashboard(fig, row=4, col=3)
        
        # Update layout
        fig.update_layout(
            title={
                'text': f'{self.symbol} - Advanced 3D Market Analysis Dashboard',
                'x': 0.5,
                'xanchor': 'center',
                'font': {'size': 24, 'color': '#2c3e50', 'family': 'Arial Black'}
            },
            showlegend=True,
            height=2400,
            paper_bgcolor='#f8f9fa',
            plot_bgcolor='white',
            font=dict(size=10),
            hovermode='closest'
        )
        
        # Save to HTML
        fig.write_html(output_file, config={'displayModeBar': True, 'responsive': True})
        print(f"3D Interactive dashboard saved to {output_file}")
        
        return fig
    
    def _add_3d_price_volume(self, fig, data, row, col):
        """Add 3D price and volume visualization"""
        df = data.copy()
        df['datetime_numeric'] = np.arange(len(df))
        
        # Price surface
        fig.add_trace(
            go.Scatter3d(
                x=df['datetime_numeric'],
                y=df['Volume'] / 1e6,
                z=df['Close'],
                mode='lines+markers',
                marker=dict(
                    size=3,
                    color=df['Close'],
                    colorscale='Viridis',
                    showscale=True,
                    colorbar=dict(title="Price", x=0.32, len=0.2)
                ),
                line=dict(color='blue', width=2),
                name='Price-Volume',
                hovertemplate='Time: %{x}<br>Volume: %{y:.1f}M<br>Price: $%{z:.2f}<extra></extra>'
            ),
            row=row, col=col
        )
        
        # Add moving average ribbon
        for ma_period, color in [(20, 'red'), (50, 'orange')]:
            if f'SMA_{ma_period}' in df.columns:
                fig.add_trace(
                    go.Scatter3d(
                        x=df['datetime_numeric'],
                        y=df['Volume'] / 1e6,
                        z=df[f'SMA_{ma_period}'],
                        mode='lines',
                        line=dict(color=color, width=1.5),
                        name=f'SMA {ma_period}',
                        opacity=0.7
                    ),
                    row=row, col=col
                )
        
        fig.update_scenes(
            dict(
                xaxis_title='Time',
                yaxis_title='Volume (M)',
                zaxis_title='Price ($)',
                camera=dict(eye=dict(x=1.5, y=1.5, z=1.3))
            ),
            row=row, col=col
        )
    
    def _add_volatility_surface(self, fig, data, row, col):
        """Create 3D volatility surface"""
        df = data.copy()
        
        # Calculate rolling volatility at different windows
        windows = [10, 20, 30, 50, 100]
        time_points = np.linspace(0, len(df)-1, 50).astype(int)
        
        vol_matrix = np.zeros((len(windows), len(time_points)))
        
        for i, window in enumerate(windows):
            returns = df['Close'].pct_change()
            rolling_vol = returns.rolling(window=window).std() * np.sqrt(252 * 390) * 100
            vol_matrix[i, :] = rolling_vol.iloc[time_points].fillna(0).values
        
        fig.add_trace(
            go.Surface(
                x=time_points,
                y=windows,
                z=vol_matrix,
                colorscale='Plasma',
                showscale=True,
                colorbar=dict(title="Vol %", x=0.66, len=0.2),
                name='Volatility Surface',
                hovertemplate='Time: %{x}<br>Window: %{y}<br>Vol: %{z:.2f}%<extra></extra>'
            ),
            row=row, col=col
        )
        
        fig.update_scenes(
            dict(
                xaxis_title='Time Period',
                yaxis_title='Rolling Window',
                zaxis_title='Volatility (%)',
                camera=dict(eye=dict(x=1.3, y=-1.3, z=1.2))
            ),
            row=row, col=col
        )
    
    def _add_correlation_heatmap(self, fig, data, row, col):
        """Add correlation matrix heatmap"""
        df = data.copy()
        
        # Select key indicators
        indicators = ['Close', 'Volume', 'RSI', 'MACD', 'Stochastic_K', 
                     'ATR', 'BB_Width', 'Williams_R', 'CCI']
        
        available_indicators = [ind for ind in indicators if ind in df.columns]
        corr_matrix = df[available_indicators].corr()
        
        fig.add_trace(
            go.Heatmap(
                z=corr_matrix.values,
                x=corr_matrix.columns,
                y=corr_matrix.columns,
                colorscale='RdBu',
                zmid=0,
                text=np.round(corr_matrix.values, 2),
                texttemplate='%{text}',
                textfont={"size": 8},
                showscale=True,
                colorbar=dict(title="Correlation", x=1.0, len=0.2),
                hovertemplate='%{x} vs %{y}<br>Correlation: %{z:.3f}<extra></extra>'
            ),
            row=row, col=col
        )
    
    def _add_3d_technical_indicators(self, fig, data, row, col):
        """Add 3D technical indicators space"""
        df = data.copy()
        df['time'] = np.arange(len(df))
        
        # Create 3D scatter with RSI, MACD, and Stochastic
        colors = df['Close'].values
        
        fig.add_trace(
            go.Scatter3d(
                x=df['RSI'].fillna(50),
                y=df['MACD'].fillna(0),
                z=df['Stochastic_K'].fillna(50),
                mode='markers+lines',
                marker=dict(
                    size=4,
                    color=colors,
                    colorscale='Turbo',
                    showscale=True,
                    colorbar=dict(title="Price", x=0.32, y=0.35, len=0.2),
                    line=dict(color='white', width=0.5)
                ),
                line=dict(color='rgba(100,100,100,0.3)', width=1),
                name='Indicator Space',
                hovertemplate='RSI: %{x:.1f}<br>MACD: %{y:.3f}<br>Stoch: %{z:.1f}<extra></extra>'
            ),
            row=row, col=col
        )
        
        # Add reference planes
        fig.add_trace(
            go.Scatter3d(
                x=[30, 30, 70, 70, 30],
                y=[-10, 10, 10, -10, -10],
                z=[20, 20, 20, 20, 20],
                mode='lines',
                line=dict(color='red', width=2, dash='dash'),
                name='RSI Zones',
                opacity=0.3
            ),
            row=row, col=col
        )
        
        fig.update_scenes(
            dict(
                xaxis_title='RSI',
                yaxis_title='MACD',
                zaxis_title='Stochastic %K',
                camera=dict(eye=dict(x=1.5, y=-1.5, z=1.3))
            ),
            row=row, col=col
        )
    
    def _add_price_volume_time_surface(self, fig, data, row, col):
        """Create price-volume-time 3D surface"""
        df = data.copy()
        
        # Create grid for surface
        time_grid = np.linspace(0, len(df)-1, 30).astype(int)
        volume_percentiles = np.linspace(0, 100, 20)
        
        # Calculate price at different volume levels over time
        price_surface = np.zeros((len(volume_percentiles), len(time_grid)))
        
        for i, t_idx in enumerate(time_grid):
            window_start = max(0, t_idx - 20)
            window_data = df.iloc[window_start:t_idx+1]
            
            for j, percentile in enumerate(volume_percentiles):
                vol_threshold = np.percentile(window_data['Volume'], percentile)
                filtered_prices = window_data[window_data['Volume'] >= vol_threshold]['Close']
                price_surface[j, i] = filtered_prices.mean() if len(filtered_prices) > 0 else df.iloc[t_idx]['Close']
        
        fig.add_trace(
            go.Surface(
                x=time_grid,
                y=volume_percentiles,
                z=price_surface,
                colorscale='Jet',
                showscale=True,
                colorbar=dict(title="Price", x=0.66, y=0.35, len=0.2),
                name='Price-Volume Surface',
                hovertemplate='Time: %{x}<br>Vol Percentile: %{y:.0f}<br>Price: $%{z:.2f}<extra></extra>'
            ),
            row=row, col=col
        )
        
        fig.update_scenes(
            dict(
                xaxis_title='Time',
                yaxis_title='Volume Percentile',
                zaxis_title='Price ($)',
                camera=dict(eye=dict(x=1.2, y=1.2, z=1.3))
            ),
            row=row, col=col
        )
    
    def _add_option_greeks_surface(self, fig, data, row, col):
        """Create option Greeks surface visualization"""
        current_price = self.forecast['current_market_state']['current_price']
        volatility = self.forecast['current_market_state'].get('atr', current_price * 0.02) / current_price
        
        # Create strike and time to expiration grids
        strikes = np.linspace(current_price * 0.9, current_price * 1.1, 30)
        days_to_exp = np.linspace(1, 30, 30)
        
        # Calculate delta surface (simplified Black-Scholes approximation)
        delta_surface = np.zeros((len(days_to_exp), len(strikes)))
        
        for i, days in enumerate(days_to_exp):
            for j, strike in enumerate(strikes):
                # Simplified delta calculation
                moneyness = np.log(current_price / strike)
                time_value = np.sqrt(days / 365)
                d1 = (moneyness + 0.5 * volatility**2 * days/365) / (volatility * time_value)
                delta_surface[i, j] = stats.norm.cdf(d1)
        
        fig.add_trace(
            go.Surface(
                x=strikes,
                y=days_to_exp,
                z=delta_surface,
                colorscale='RdYlGn',
                showscale=True,
                colorbar=dict(title="Delta", x=1.0, y=0.35, len=0.2),
                name='Call Delta Surface',
                hovertemplate='Strike: $%{x:.2f}<br>Days: %{y:.0f}<br>Delta: %{z:.3f}<extra></extra>'
            ),
            row=row, col=col
        )
        
        fig.update_scenes(
            dict(
                xaxis_title='Strike Price ($)',
                yaxis_title='Days to Expiration',
                zaxis_title='Call Delta',
                camera=dict(eye=dict(x=1.5, y=-1.3, z=1.2))
            ),
            row=row, col=col
        )
    
    def _add_3d_pattern_recognition(self, fig, data, row, col):
        """Visualize pattern detection in 3D space"""
        df = data.copy()
        
        # Use PCA to reduce price action to 3D space
        features = ['Close', 'Volume', 'RSI', 'MACD', 'ATR']
        available_features = [f for f in features if f in df.columns]
        
        X = df[available_features].fillna(method='ffill').fillna(0).values
        
        if len(X) > 3:
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            pca = PCA(n_components=3)
            X_3d = pca.fit_transform(X_scaled)
            
            # Color by pattern type (simplified)
            patterns = self.forecast.get('patterns_detected', {})
            colors = ['blue'] * len(X_3d)
            
            # Mark detected patterns
            if patterns.get('double_top', {}).get('detected'):
                colors[-20:] = ['red'] * 20
            if patterns.get('double_bottom', {}).get('detected'):
                colors[-20:] = ['green'] * 20
            
            fig.add_trace(
                go.Scatter3d(
                    x=X_3d[:, 0],
                    y=X_3d[:, 1],
                    z=X_3d[:, 2],
                    mode='markers+lines',
                    marker=dict(
                        size=3,
                        color=colors,
                        line=dict(color='white', width=0.5)
                    ),
                    line=dict(color='rgba(100,100,100,0.2)', width=1),
                    name='Pattern Space',
                    hovertemplate='PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>PC3: %{z:.2f}<extra></extra>'
                ),
                row=row, col=col
            )
            
            fig.update_scenes(
                dict(
                    xaxis_title=f'PC1 ({pca.explained_variance_ratio_[0]:.1%})',
                    yaxis_title=f'PC2 ({pca.explained_variance_ratio_[1]:.1%})',
                    zaxis_title=f'PC3 ({pca.explained_variance_ratio_[2]:.1%})',
                    camera=dict(eye=dict(x=1.5, y=1.5, z=1.3))
                ),
                row=row, col=col
            )
    
    def _add_monte_carlo_paths(self, fig, data, row, col):
        """Add Monte Carlo simulation paths"""
        df = data.copy()
        
        # Calculate returns statistics
        returns = df['Close'].pct_change().dropna()
        mu = returns.mean()
        sigma = returns.std()
        
        # Generate Monte Carlo paths
        n_simulations = 50
        n_steps = 30
        last_price = df['Close'].iloc[-1]
        
        paths = np.zeros((n_simulations, n_steps))
        paths[:, 0] = last_price
        
        for i in range(n_simulations):
            for t in range(1, n_steps):
                shock = np.random.normal(mu, sigma)
                paths[i, t] = paths[i, t-1] * (1 + shock)
        
        # Create time array
        time_steps = np.arange(n_steps)
        
        # Add paths
        for i in range(n_simulations):
            fig.add_trace(
                go.Scatter3d(
                    x=time_steps,
                    y=[i] * n_steps,
                    z=paths[i, :],
                    mode='lines',
                    line=dict(
                        color=paths[i, -1],
                        colorscale='RdYlGn',
                        width=2
                    ),
                    opacity=0.6,
                    showlegend=False,
                    hovertemplate=f'Sim {i}<br>Step: %{{x}}<br>Price: $%{{z:.2f}}<extra></extra>'
                ),
                row=row, col=col
            )
        
        # Add forecast point
        ml_forecast = self.forecast.get('ml_forecast', {})
        predicted_price = ml_forecast.get('predicted_price')
        if predicted_price:
            fig.add_trace(
                go.Scatter3d(
                    x=[n_steps-1],
                    y=[n_simulations // 2],
                    z=[predicted_price],
                    mode='markers',
                    marker=dict(size=15, color='gold', symbol='diamond',
                               line=dict(color='black', width=2)),
                    name='ML Forecast',
                    hovertemplate=f'ML Forecast<br>Price: ${predicted_price:.2f}<extra></extra>'
                ),
                row=row, col=col
            )
        
        fig.update_scenes(
            dict(
                xaxis_title='Time Steps',
                yaxis_title='Simulation #',
                zaxis_title='Price ($)',
                camera=dict(eye=dict(x=2, y=-1.5, z=1))
            ),
            row=row, col=col
        )
    
    def _add_sentiment_evolution(self, fig, data, row, col):
        """Visualize sentiment evolution in 3D"""
        df = data.copy()
        
        # Calculate rolling sentiment indicators
        window_sizes = [10, 20, 30]
        time_points = np.arange(0, len(df), 5)
        
        sentiment_scores = []
        
        for t in time_points:
            window_end = min(t + 30, len(df))
            window_data = df.iloc[t:window_end]
            
            # Calculate sentiment based on indicators
            rsi_score = (window_data['RSI'].mean() - 50) / 50 if 'RSI' in window_data else 0
            macd_score = np.sign(window_data['MACD'].mean()) if 'MACD' in window_data else 0
            
            sentiment = (rsi_score + macd_score) / 2
            sentiment_scores.append(sentiment)
        
        # Create 3D trajectory
        time_array = time_points
        rsi_array = [df['RSI'].iloc[min(t, len(df)-1)] if 'RSI' in df else 50 for t in time_points]
        
        fig.add_trace(
            go.Scatter3d(
                x=time_array,
                y=rsi_array,
                z=sentiment_scores,
                mode='lines+markers',
                marker=dict(
                    size=5,
                    color=sentiment_scores,
                    colorscale='RdYlGn',
                    showscale=True,
                    colorbar=dict(title="Sentiment", x=1.0, y=0.0, len=0.2),
                    line=dict(color='white', width=0.5)
                ),
                line=dict(color='blue', width=3),
                name='Sentiment Evolution',
                hovertemplate='Time: %{x}<br>RSI: %{y:.1f}<br>Sentiment: %{z:.2f}<extra></extra>'
            ),
            row=row, col=col
        )
        
        # Add neutral plane
        fig.add_trace(
            go.Mesh3d(
                x=[0, len(df), len(df), 0],
                y=[0, 0, 100, 100],
                z=[0, 0, 0, 0],
                opacity=0.2,
                color='gray',
                name='Neutral Level'
            ),
            row=row, col=col
        )
        
        fig.update_scenes(
            dict(
                xaxis_title='Time',
                yaxis_title='RSI',
                zaxis_title='Sentiment Score',
                camera=dict(eye=dict(x=1.5, y=-1.5, z=1.2))
            ),
            row=row, col=col
        )
    
    def _add_3d_support_resistance(self, fig, data, row, col):
        """Visualize support and resistance in 3D"""
        df = data.copy()
        df['time'] = np.arange(len(df))
        
        sr = self.forecast['patterns_detected'].get('support_resistance', {})
        
        # Plot price path
        fig.add_trace(
            go.Scatter3d(
                x=df['time'],
                y=df['Volume'] / 1e6,
                z=df['Close'],
                mode='lines',
                line=dict(color='blue', width=3),
                name='Price Path',
                hovertemplate='Time: %{x}<br>Volume: %{y:.1f}M<br>Price: $%{z:.2f}<extra></extra>'
            ),
            row=row, col=col
        )
        
        # Add resistance planes
        if sr.get('detected') and sr.get('nearest_resistance'):
            for i, res in enumerate(sr['nearest_resistance'][:2]):
                fig.add_trace(
                    go.Mesh3d(
                        x=[0, len(df), len(df), 0],
                        y=[0, 0, df['Volume'].max()/1e6, df['Volume'].max()/1e6],
                        z=[res, res, res, res],
                        opacity=0.3,
                        color='red',
                        name=f'Resistance {i+1}',
                        showlegend=True
                    ),
                    row=row, col=col
                )
        
        # Add support planes
        if sr.get('detected') and sr.get('nearest_support'):
            for i, sup in enumerate(sr['nearest_support'][:2]):
                fig.add_trace(
                    go.Mesh3d(
                        x=[0, len(df), len(df), 0],
                        y=[0, 0, df['Volume'].max()/1e6, df['Volume'].max()/1e6],
                        z=[sup, sup, sup, sup],
                        opacity=0.3,
                        color='green',
                        name=f'Support {i+1}',
                        showlegend=True
                    ),
                    row=row, col=col
                )
        
        fig.update_scenes(
            dict(
                xaxis_title='Time',
                yaxis_title='Volume (M)',
                zaxis_title='Price ($)',
                camera=dict(eye=dict(x=2, y=-1, z=1))
            ),
            row=row, col=col
        )
    
    def _add_candlestick_volume_profile(self, fig, data, row, col):
        """Add candlestick with volume profile"""
        df = data.copy()
        df['datetime'] = pd.to_datetime(df.index if isinstance(df.index, pd.DatetimeIndex) else range(len(df)))
        
        # Add candlestick
        fig.add_trace(
            go.Candlestick(
                x=df['datetime'],
                open=df['Open'],
                high=df['High'],
                low=df['Low'],
                close=df['Close'],
                name='OHLC',
                increasing=dict(line=dict(color='green')),
                decreasing=dict(line=dict(color='red'))
            ),
            row=row, col=col
        )
        
        # Add volume bars on secondary y-axis
        fig.add_trace(
            go.Bar(
                x=df['datetime'],
                y=df['Volume'],
                name='Volume',
                marker_color='rgba(100,100,200,0.3)',
                yaxis='y2'
            ),
            row=row, col=col, secondary_y=True
        )
        
        # Add moving averages
        for ma, color in [(20, 'blue'), (50, 'orange')]:
            if f'SMA_{ma}' in df.columns:
                fig.add_trace(
                    go.Scatter(
                        x=df['datetime'],
                        y=df[f'SMA_{ma}'],
                        name=f'SMA {ma}',
                        line=dict(color=color, width=2)
                    ),
                    row=row, col=col
                )
        
        fig.update_xaxes(title_text="Time", row=row, col=col)
        fig.update_yaxes(title_text="Price ($)", row=row, col=col)
        fig.update_yaxes(title_text="Volume", secondary_y=True, row=row, col=col)
    
    def _add_risk_dashboard(self, fig, row, col):
        """Add risk metrics dashboard"""
        risk = self.forecast.get('risk_assessment', {})
        sentiment = self.forecast['market_sentiment']
        
        # Create gauge chart for risk level
        risk_score = risk.get('score', 0)
        
        fig.add_trace(
            go.Indicator(
                mode="gauge+number+delta",
                value=risk_score,
                title={'text': f"Risk Level: {risk.get('level', 'UNKNOWN')}"},
                delta={'reference': 5},
                gauge={
                    'axis': {'range': [None, 10]},
                    'bar': {'color': "darkred" if risk_score > 7 else "orange" if risk_score > 4 else "green"},
                    'steps': [
                        {'range': [0, 3], 'color': "lightgreen"},
                        {'range': [3, 6], 'color': "yellow"},
                        {'range': [6, 10], 'color': "lightcoral"}
                    ],
                    'threshold': {
                        'line': {'color': "red", 'width': 4},
                        'thickness': 0.75,
                        'value': 7
                    }
                }
            ),
            row=row, col=col
        )


def create_all_3d_visualizations(forecast_file='forecast_monday_1pm.json'):
    """Create all 3D visualizations from forecast data"""
    
    print("\n" + "="*80)
    print("CREATING ADVANCED 3D VISUALIZATIONS")
    print("="*80 + "\n")
    
    # Load forecast data
    with open(forecast_file, 'r') as f:
        all_forecasts = json.load(f)
    
    for symbol, forecast_data in all_forecasts.items():
        print(f"\nCreating 3D visualization for {symbol}...")
        
        try:
            # Create visualizer
            visualizer = Advanced3DVisualizer(forecast_data)
            
            # Fetch data
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="5d", interval="1m")
            
            if data.empty:
                print(f"No data available for {symbol}")
                continue
            
            # Calculate indicators
            data['SMA_20'] = data['Close'].rolling(window=20).mean()
            data['SMA_50'] = data['Close'].rolling(window=50).mean()
            data['EMA_12'] = data['Close'].ewm(span=12, adjust=False).mean()
            data['EMA_26'] = data['Close'].ewm(span=26, adjust=False).mean()
            data['MACD'] = data['EMA_12'] - data['EMA_26']
            
            delta = data['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            data['RSI'] = 100 - (100 / (1 + rs))
            
            data['BB_Middle'] = data['Close'].rolling(window=20).mean()
            data['BB_Std'] = data['Close'].rolling(window=20).std()
            data['BB_Upper'] = data['BB_Middle'] + (data['BB_Std'] * 2)
            data['BB_Lower'] = data['BB_Middle'] - (data['BB_Std'] * 2)
            data['BB_Width'] = ((data['BB_Upper'] - data['BB_Lower']) / data['BB_Middle']) * 100
            
            low_min = data['Low'].rolling(window=14).min()
            high_max = data['High'].rolling(window=14).max()
            data['Stochastic_K'] = 100 * ((data['Close'] - low_min) / (high_max - low_min))
            
            data['Williams_R'] = -100 * ((high_max - data['Close']) / (high_max - low_min))
            
            tp = (data['High'] + data['Low'] + data['Close']) / 3
            data['CCI'] = (tp - tp.rolling(20).mean()) / (0.015 * tp.rolling(20).std())
            
            high_low = data['High'] - data['Low']
            high_close = np.abs(data['High'] - data['Close'].shift())
            low_close = np.abs(data['Low'] - data['Close'].shift())
            ranges = pd.concat([high_low, high_close, low_close], axis=1)
            true_range = np.max(ranges, axis=1)
            data['ATR'] = true_range.rolling(14).mean()
            
            # Create 3D dashboard
            output_file = f'forecast_{symbol.replace("^", "")}_3d_interactive.html'
            visualizer.create_comprehensive_3d_dashboard(data, output_file)
            
            print(f"✓ 3D Visualization created: {output_file}")
            
        except Exception as e:
            print(f"Error creating 3D visualization for {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*80)
    print("3D VISUALIZATION GENERATION COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    create_all_3d_visualizations()
