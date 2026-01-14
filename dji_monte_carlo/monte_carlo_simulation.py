#!/usr/bin/env python3
"""
DJI Monte Carlo Intraday Simulation
====================================
A Monte Carlo simulation for DJI (Dow Jones Industrial Average) intraday price projections
using Geometric Brownian Motion (GBM).

This script generates price path simulations and visualizations for market analysis.

Environment Variables (optional):
    CURRENT_PRICE: Starting price for simulation (default: 52417.00)
    MINUTES_REMAINING: Trading minutes to simulate (default: 207)
    SIMULATIONS: Number of Monte Carlo paths (default: 5000)
    SIGMA: Annualized volatility as decimal (default: 0.14)
    MU: Drift rate as decimal (default: 0.02)
    RANDOM_SEED: Fixed seed for reproducibility, empty for true randomness (default: 55)
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import os
from datetime import datetime

# ==========================================
# 1. SIMULATION CONFIGURATION
# ==========================================
# Default context: Wednesday, Jan 14, 2026 @ 9:33 AM PST -> 1:00 PM PST
# Parameters can be overridden via environment variables
current_price = float(os.environ.get('CURRENT_PRICE', 52417.00))
minutes_remaining = int(os.environ.get('MINUTES_REMAINING', 207))
simulations = int(os.environ.get('SIMULATIONS', 5000))

# Market Regime: "Consolidation / Pinning"
# DJI typically has lower volatility than SPX. 
# We assume a "Mean Reversion" bias where price chops around the current level.
sigma = float(os.environ.get('SIGMA', 0.14))  # 14% Annualized Volatility (Low/Moderate)
mu = float(os.environ.get('MU', 0.02))        # Near-zero drift (Neutral bias)

# ==========================================
# 2. MONTE CARLO ENGINE (GBM)
# ==========================================
# Fixed seed for reproducibility; set RANDOM_SEED="" for true randomness
random_seed = os.environ.get('RANDOM_SEED', '55')
if random_seed:
    np.random.seed(int(random_seed))
dt = 1 / (252 * 390) # 1-minute time step

# Initialize paths [Time Steps x Simulations]
paths = np.zeros((minutes_remaining + 1, simulations))
paths[0] = current_price

for t in range(1, minutes_remaining + 1):
    Z = np.random.standard_normal(simulations)
    # Standard Geometric Brownian Motion
    paths[t] = paths[t-1] * np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z)

# ==========================================
# 3. STATISTICAL ANALYSIS
# ==========================================
final_prices = paths[-1]
mean_close = np.mean(final_prices)
p95 = np.percentile(final_prices, 95)
p05 = np.percentile(final_prices, 5)
p75 = np.percentile(final_prices, 75)
p25 = np.percentile(final_prices, 25)

# ==========================================
# 4. VISUALIZATION DASHBOARD
# ==========================================
fig = plt.figure(figsize=(14, 8))
fig.patch.set_facecolor('#0E1117')
gs = gridspec.GridSpec(2, 2, width_ratios=[3, 1])

# --- Chart 1: Intraday Projection (The Chop) ---
ax1 = fig.add_subplot(gs[:, 0])
ax1.set_facecolor('#0E1117')

# Plot Confidence Intervals
time_axis = np.arange(minutes_remaining + 1)
ax1.fill_between(time_axis, np.percentile(paths, 5, axis=1), np.percentile(paths, 95, axis=1), 
                 color='#7B1FA2', alpha=0.15, label='95% Volatility Range')
ax1.fill_between(time_axis, np.percentile(paths, 25, axis=1), np.percentile(paths, 75, axis=1), 
                 color='#7B1FA2', alpha=0.3, label='Likely Consolidation Zone')

# Plot Mean Path
ax1.plot(np.mean(paths, axis=1), color='#00E676', linewidth=2.5, linestyle='--', label='Projected Mean Path')

# Key Levels (Derived from Chart Analysis)
ax1.axhline(52550, color='#FF1744', linestyle=':', linewidth=1.5, label='Resistance (1H Breakdown)')
ax1.axhline(52350, color='#2979FF', linestyle=':', linewidth=1.5, label='Support (15m Lows)')

# Styling
ax1.set_title(f"DJI Intraday Projection: 9:33 AM -> 1:00 PM PST", color='white', fontsize=14)
ax1.set_ylabel("Price", color='white')
ax1.set_xlabel("Minutes Remaining", color='white')
ax1.legend(facecolor='#1A1A2E', labelcolor='white', loc='upper left')
ax1.tick_params(colors='white')
ax1.grid(color='#333333', alpha=0.5)

# --- Chart 2: Price Distribution at Close ---
ax2 = fig.add_subplot(gs[0, 1])
ax2.set_facecolor('#0E1117')
ax2.hist(final_prices, bins=50, color='#7B1FA2', edgecolor='black', alpha=0.8, orientation='horizontal')
ax2.axhline(mean_close, color='#00E676', linestyle='--', linewidth=2, label=f'Mean: ${mean_close:,.0f}')
ax2.axhline(p95, color='#FF1744', linestyle=':', linewidth=1.5, label=f'95th: ${p95:,.0f}')
ax2.axhline(p05, color='#2979FF', linestyle=':', linewidth=1.5, label=f'5th: ${p05:,.0f}')
ax2.set_title("Final Price Distribution", color='white', fontsize=12)
ax2.set_xlabel("Frequency", color='white')
ax2.tick_params(colors='white')
ax2.legend(facecolor='#1A1A2E', labelcolor='white', fontsize=8)

# --- Chart 3: Statistics Panel ---
ax3 = fig.add_subplot(gs[1, 1])
ax3.set_facecolor('#0E1117')
ax3.axis('off')

stats_text = f"""
╔══════════════════════════════════╗
║   SIMULATION STATISTICS          ║
╠══════════════════════════════════╣
║ Start Price:     ${current_price:>12,.2f} ║
║ Mean Close:      ${mean_close:>12,.2f} ║
║ 95th Percentile: ${p95:>12,.2f} ║
║ 75th Percentile: ${p75:>12,.2f} ║
║ 25th Percentile: ${p25:>12,.2f} ║
║ 5th Percentile:  ${p05:>12,.2f} ║
╠══════════════════════════════════╣
║ Simulations:          {simulations:>10,} ║
║ Minutes Simulated:    {minutes_remaining:>10} ║
║ Volatility (σ):       {sigma*100:>9.1f}% ║
║ Drift (μ):            {mu*100:>9.1f}% ║
╚══════════════════════════════════╝
"""
ax3.text(0.5, 0.5, stats_text, transform=ax3.transAxes, fontsize=9, 
         verticalalignment='center', horizontalalignment='center',
         color='#00E676', fontfamily='monospace')

plt.tight_layout()

# Save the figure
output_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(output_dir, 'dji_simulation_output.png')
plt.savefig(output_file, dpi=150, facecolor='#0E1117', edgecolor='none')
print(f"Simulation complete. Output saved to: {output_file}")

# Print summary statistics
print("\n" + "="*50)
print("DJI MONTE CARLO SIMULATION RESULTS")
print("="*50)
print(f"Start Price:     ${current_price:,.2f}")
print(f"Mean Close:      ${mean_close:,.2f}")
print(f"95th Percentile: ${p95:,.2f}")
print(f"75th Percentile: ${p75:,.2f}")
print(f"25th Percentile: ${p25:,.2f}")
print(f"5th Percentile:  ${p05:,.2f}")
print("="*50)
print(f"Simulations: {simulations:,}")
print(f"Minutes Simulated: {minutes_remaining}")
print(f"Volatility (σ): {sigma*100:.1f}%")
print(f"Drift (μ): {mu*100:.1f}%")
print("="*50)

# Close the plot to free memory
plt.close(fig)
