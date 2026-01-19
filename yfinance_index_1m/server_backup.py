#!/usr/bin/env python3
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import os
from datetime import datetime, timedelta
import threading
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.logging import RichHandler
import logging

console = Console()
logging.basicConfig(level=logging.INFO, format="%(message)s", handlers=[RichHandler(console=console, rich_tracebacks=True, show_path=False)])
log = logging.getLogger("rich")

app = Flask(__name__)
CORS(app)
last_forecast_time = None
forecast_lock = threading.Lock()

def get_next_trading_day_1pm():
    now = datetime.now()
    next_close = now.replace(hour=13, minute=0, second=0, microsecond=0)
    if now.hour >= 13: next_close += timedelta(days=1)
    while next_close.weekday() >= 5: next_close += timedelta(days=1)
    return next_close

def format_target_time():
    return get_next_trading_day_1pm().strftime("%A, %B %d, %Y at %I:%M %p")

@app.route("/")
def index():
    log.info(f"[cyan]📊 Dashboard: {request.remote_addr}[/cyan]")
    return send_file("forecast.html")

@app.route("/forecast_monday_1pm.json")
def forecast_data():
    try:
        log.info("[green]📈 JSON requested[/green]")
        return send_file("forecast_monday_1pm.json", mimetype="application/json")
    except FileNotFoundError:
        log.error("[red]❌ Not found[/red]")
        return jsonify({"error": "Not found"}), 404

@app.route("/forecast_<symbol>_chart.png")
def chart_image(symbol):
    try:
        log.info(f"[blue]📊 Chart: {symbol}[/blue]")
        return send_file(f"forecast_{symbol}_chart.png", mimetype="image/png")
    except FileNotFoundError:
        log.warning(f"[yellow]⚠️  Missing: {symbol}[/yellow]")
        return jsonify({"error": "Not found"}), 404

@app.route("/forecast_<symbol>_enhanced_chart.png")
def enhanced_chart(symbol):
    try:
        log.info(f"[magenta]📈 Enhanced: {symbol}[/magenta]")
        return send_file(f"forecast_{symbol}_enhanced_chart.png", mimetype="image/png")
    except FileNotFoundError:
        return jsonify({"error": "Not found"}), 404

@app.route("/forecast_<symbol>_3d_interactive.html")
def chart_3d(symbol):
    try:
        log.info(f"[cyan]🎨 3D: {symbol}[/cyan]")
        return send_file(f"forecast_{symbol}_3d_interactive.html", mimetype="text/html")
    except FileNotFoundError:
        return jsonify({"error": "Not found"}), 404

@app.route("/api/status")
def status():
    log.info("[green]🔍 Status[/green]")
    fc = "forecast_monday_1pm.json"
    exists = os.path.exists(fc)
    age = (datetime.now() - datetime.fromtimestamp(os.path.getmtime(fc))).total_seconds() / 3600 if exists else None
    return jsonify({"server_time": datetime.now().isoformat(), "target": format_target_time(), "forecast_exists": exists, "age_hours": round(age, 2) if age else None})

@app.route("/api/target-time")
def target_time():
    log.info("[cyan]🎯 Target[/cyan]")
    return jsonify({"target": format_target_time()})

@app.route("/health")
def health():
    log.info("[green]💚 Health[/green]")
    return jsonify({"status": "healthy"})

def startup():
    fc = "forecast_monday_1pm.json"
    if not os.path.exists(fc):
        console.print("[yellow]⚠️  Forecast missing. Generate with: python genai_forecaster.py[/yellow]")
    else:
        age = (datetime.now() - datetime.fromtimestamp(os.path.getmtime(fc))).total_seconds() / 3600
        if age < 4:
            console.print(f"[green]✅ Forecast current ({age:.1f}h old)[/green]")
        else:
            console.print(f"[yellow]⚠️  Forecast stale ({age:.1f}h old)[/yellow]")

if __name__ == "__main__":
    console.rule("[bold blue]🚀 GENAI FORECASTING SERVER[/bold blue]", style="blue")
    console.print()
    t = Table(show_header=False, box=None, padding=(0,2))
    t.add_column(style="cyan bold", width=12)
    t.add_column(style="white")
    t.add_row("🎯 Target:", format_target_time())
    t.add_row("📅 Time:", datetime.now().strftime("%A, %B %d, %Y %I:%M %p"))
    t.add_row("🎨 Rich:", "Enabled ✓")
    console.print(t)
    console.print()
    startup()
    console.rule("[bold green]SERVER READY[/bold green]", style="green")
    console.print()
    e = Table(title="[bold]🌐 Endpoints[/bold]", show_header=True, header_style="bold magenta", border_style="blue")
    e.add_column("URL", style="cyan")
    e.add_column("Description", style="white")
    e.add_row("http://localhost:5000", "📊 Dashboard")
    e.add_row("http://localhost:5000/api/status", "🔍 Status")
    e.add_row("http://localhost:5000/health", "💚 Health")
    console.print(e)
    console.print()
    console.print(Panel.fit("[bold yellow]💡 Ctrl+C to stop[/bold yellow]\n[dim]Rich logging active[/dim]", border_style="yellow"))
    console.print()
    log.info("[bold green]🚀 Starting on http://0.0.0.0:5000[/bold green]")
    console.print()
    try:
        app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
    except KeyboardInterrupt:
        console.print("\n")
        console.rule("[bold red]SHUTTING DOWN[/bold red]", style="red")
        console.print("\n[yellow]👋 Goodbye![/yellow]\n")
