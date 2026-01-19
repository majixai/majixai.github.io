#!/usr/bin/env python3
"""
GenAI Forecast Server with Rich Logging
"""

from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import os
import json
from datetime import datetime, timedelta
import threading
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.logging import RichHandler
import logging

# Initialize Rich console
console = Console()

# Configure logging with Rich
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(console=console, rich_tracebacks=True, show_path=False)]
)
log = logging.getLogger("rich")

app = Flask(__name__)
CORS(app)

last_forecast_time = None
forecast_lock = threading.Lock()


def get_next_trading_day_1pm():
    now = datetime.now()
    target_hour, target_minute = 13, 0
    next_close = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    if now.hour >= 13 or now.hour >= 16:
        next_close += timedelta(days=1)
    while next_close.weekday() >= 5:
        next_close += timedelta(days=1)
    return next_close


def format_target_time():
    target = get_next_trading_day_1pm()
    return target.strftime('%A, %B %d, %Y at %I:%M %p')


@app.route('/')
def index():
    log.info(f"[cyan]📊 Dashboard accessed from {request.remote_addr}[/cyan]")
    return send_file('index.html')


# Static file routes
@app.route('/style.css')
def serve_css():
    return send_file('style.css', mimetype='text/css')


@app.route('/script_enhanced.js')
def serve_script():
    return send_file('script_enhanced.js', mimetype='application/javascript')


@app.route('/webhook-handler.js')
def serve_webhook():
    return send_file('webhook-handler.js', mimetype='application/javascript')


@app.route('/pwa-installer.js')
def serve_pwa():
    return send_file('pwa-installer.js', mimetype='application/javascript')


@app.route('/service-worker.js')
def serve_sw():
    return send_file('service-worker.js', mimetype='application/javascript')


@app.route('/manifest.json')
def serve_manifest():
    return send_file('manifest.json', mimetype='application/json')


@app.route('/icons/<path:filename>')
def serve_icons(filename):
    return send_file(f'icons/{filename}', mimetype='image/png')


@app.route('/multi_timeframe.dat')
def multi_timeframe_data():
    try:
        log.info("[green]📊 Multi-timeframe ML data requested[/green]")
        # Try ML-enhanced version first
        try:
            return send_file('multi_timeframe_ml.dat', mimetype='application/octet-stream')
        except FileNotFoundError:
            log.info("[yellow]Using standard multi-timeframe data[/yellow]")
            return send_file('multi_timeframe.dat', mimetype='application/octet-stream')
    except FileNotFoundError:
        log.warning("[yellow]⚠️  Multi-timeframe data not found, using fallback[/yellow]")
        try:
            return send_file('index_1m.dat', mimetype='application/octet-stream')
        except:
            return jsonify({'error': 'Data not found'}), 404


@app.route('/forecast_monday_1pm.json')
def forecast_data():
    try:
        log.info("[green]📈 Forecast JSON requested[/green]")
        return send_file('forecast_monday_1pm.json', mimetype='application/json')
    except FileNotFoundError:
        log.error("[red]❌ Forecast file not found[/red]")
        return jsonify({'error': 'Forecast not found'}), 404


@app.route('/forecast_<symbol>_chart.png')
def chart_image(symbol):
    try:
        log.info(f"[blue]📊 Standard chart requested: {symbol}[/blue]")
        return send_file(f'forecast_{symbol}_chart.png', mimetype='image/png')
    except FileNotFoundError:
        log.warning(f"[yellow]⚠️  Chart not found: {symbol}[/yellow]")
        return jsonify({'error': f'Chart for {symbol} not found'}), 404


@app.route('/forecast_<symbol>_enhanced_chart.png')
def enhanced_chart_image(symbol):
    try:
        log.info(f"[magenta]📈 Enhanced chart requested: {symbol}[/magenta]")
        return send_file(f'forecast_{symbol}_enhanced_chart.png', mimetype='image/png')
    except FileNotFoundError:
        log.warning(f"[yellow]⚠️  Enhanced chart not found: {symbol}[/yellow]")
        return jsonify({'error': f'Enhanced chart for {symbol} not found'}), 404


@app.route('/forecast_<symbol>_3d_interactive.html')
def chart_3d_interactive(symbol):
    try:
        log.info(f"[cyan]🎨 3D visualization requested: {symbol}[/cyan]")
        return send_file(f'forecast_{symbol}_3d_interactive.html', mimetype='text/html')
    except FileNotFoundError:
        log.warning(f"[yellow]⚠️  3D visualization not found: {symbol}[/yellow]")
        return jsonify({'error': f'3D visualization for {symbol} not found'}), 404


@app.route('/api/status')
def status():
    log.info("[green]🔍 Status check requested[/green]")
    forecast_file = 'forecast_monday_1pm.json'
    forecast_exists = os.path.exists(forecast_file)
    forecast_age_hours = None
    if forecast_exists:
        file_time = datetime.fromtimestamp(os.path.getmtime(forecast_file))
        forecast_age_hours = (datetime.now() - file_time).total_seconds() / 3600
    return jsonify({
        'server_time': datetime.now().isoformat(),
        'target_time': format_target_time(),
        'forecast_exists': forecast_exists,
        'forecast_age_hours': round(forecast_age_hours, 2) if forecast_age_hours else None
    })


@app.route('/api/generate', methods=['POST'])
def generate_forecast():
    global last_forecast_time
    with forecast_lock:
        try:
            console.rule("[bold blue]GENERATING FRESH FORECAST VIA API[/bold blue]", style="blue")
            log.info("[yellow]🔄 Starting forecast generation...[/yellow]")
            import genai_forecaster
            import forecast_visualizer
            with Progress(SpinnerColumn(), TextColumn("{task.description}"), BarColumn(), console=console) as progress:
                task1 = progress.add_task("[cyan]🤖 Generating forecasts...", total=100)
                genai_forecaster.main()
                progress.update(task1, completed=100)
                task2 = progress.add_task("[magenta]📊 Creating visualizations...", total=100)
                forecast_visualizer.create_all_visualizations()
                progress.update(task2, completed=100)
            last_forecast_time = datetime.now()
            log.info(f"[bold green]✅ Forecast generated at {last_forecast_time.strftime('%I:%M %p')}[/bold green]")
            return jsonify({'success': True, 'message': 'Forecast generated', 'timestamp': last_forecast_time.isoformat()})
        except Exception as e:
            log.exception("[bold red]❌ Error generating forecast[/bold red]")
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/target-time')
def target_time_info():
    log.info("[cyan]🎯 Target time info requested[/cyan]")
    target = get_next_trading_day_1pm()
    return jsonify({
        'target_datetime': target.isoformat(),
        'target_formatted': format_target_time(),
        'hours_until': round((target - datetime.now()).total_seconds() / 3600, 2)
    })


@app.route('/health')
def health():
    log.info("[green]💚 Health check[/green]")
    return jsonify({'status': 'healthy', 'service': 'GenAI Market Forecasting'})


def auto_generate_on_startup():
    global last_forecast_time
    forecast_file = 'forecast_monday_1pm.json'
    should_generate = False
    if not os.path.exists(forecast_file):
        console.print("\n[yellow]⚠️  No forecast found. Generating...[/yellow]")
        should_generate = True
    else:
        file_time = datetime.fromtimestamp(os.path.getmtime(forecast_file))
        age_hours = (datetime.now() - file_time).total_seconds() / 3600
        if age_hours > 4:
            console.print(f"\n[yellow]⚠️  Forecast {age_hours:.1f}h old. Refreshing...[/yellow]")
            should_generate = True
    if should_generate:
        try:
            import genai_forecaster
            import forecast_visualizer
            with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
                task1 = progress.add_task("[cyan]🤖 Generating forecast...", total=None)
                genai_forecaster.main()
                progress.update(task1, completed=True)
                task2 = progress.add_task("[magenta]📊 Creating charts...", total=None)
                forecast_visualizer.create_all_visualizations()
                progress.update(task2, completed=True)
            last_forecast_time = datetime.now()
            console.print(f"\n[bold green]✅ Forecast generated at {last_forecast_time.strftime('%I:%M %p')}[/bold green]\n")
        except Exception as e:
            console.print(f"\n[bold red]❌ Error: {str(e)}[/bold red]\n")
            log.exception("Forecast generation error")
    else:
        console.print("\n[green]✅ Existing forecast is current[/green]\n")
        if os.path.exists(forecast_file):
            last_forecast_time = datetime.fromtimestamp(os.path.getmtime(forecast_file))


if __name__ == '__main__':
    console.rule("[bold blue]🚀 GENAI MARKET FORECASTING SERVER[/bold blue]", style="blue")
    console.print()
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(style="cyan bold", width=15)
    table.add_column(style="white")
    table.add_row("🎯 Target:", format_target_time())
    table.add_row("📅 Time:", datetime.now().strftime('%A, %B %d, %Y at %I:%M %p'))
    table.add_row("🎨 Rich:", "Enabled ✓")
    console.print(table)
    console.print()
    auto_generate_on_startup()
    console.rule("[bold green]SERVER READY[/bold green]", style="green")
    console.print()
    endpoints = Table(title="[bold]🌐 Endpoints[/bold]", show_header=True, header_style="bold magenta", border_style="blue")
    endpoints.add_column("URL", style="cyan")
    endpoints.add_column("Description", style="white")
    endpoints.add_row("http://localhost:5000", "📊 Dashboard")
    endpoints.add_row("http://localhost:5000/api/status", "🔍 Status")
    endpoints.add_row("http://localhost:5000/api/target-time", "🎯 Target")
    endpoints.add_row("http://localhost:5000/health", "💚 Health")
    console.print(endpoints)
    console.print()
    console.print(Panel.fit("[bold yellow]💡 Press Ctrl+C to stop[/bold yellow]\n[dim]Rich logging enabled[/dim]", border_style="yellow"))
    console.print()
    log.info("[bold green]🚀 Server starting on http://0.0.0.0:5000[/bold green]")
    console.print()
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    except KeyboardInterrupt:
        console.print("\n")
        console.rule("[bold red]SHUTTING DOWN[/bold red]", style="red")
        console.print("\n[yellow]👋 Goodbye![/yellow]\n")
