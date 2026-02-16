"""
Dashboard View for displaying portfolio and market information.
"""
from typing import Dict, List, Any
import json


class DashboardView:
    """View class for rendering dashboard data."""

    def __init__(self, title: str = "Quantix Dashboard"):
        """
        Initialize the DashboardView.

        Args:
            title: Dashboard title.
        """
        self.title = title

    def render_portfolio(self, portfolio_data: Dict[str, Any]) -> str:
        """
        Render portfolio data as HTML.

        Args:
            portfolio_data: Dictionary with portfolio holdings and summary.

        Returns:
            HTML string representation.
        """
        holdings = portfolio_data.get("holdings", {})
        summary = portfolio_data.get("summary", {})

        html = f"""
        <div class="portfolio-card">
            <h2>Portfolio Summary</h2>
            <p>ID: {summary.get('portfolio_id', 'N/A')}</p>
            <p>Total Holdings: {summary.get('total_holdings', 0)}</p>
            <p>Total Transactions: {summary.get('total_transactions', 0)}</p>
            <h3>Holdings</h3>
            <table class="holdings-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Quantity</th>
                    </tr>
                </thead>
                <tbody>
        """

        for symbol, quantity in holdings.items():
            html += f"""
                    <tr>
                        <td>{symbol}</td>
                        <td>{quantity}</td>
                    </tr>
            """

        html += """
                </tbody>
            </table>
        </div>
        """
        return html

    def render_market_data(self, market_data: Dict[str, Any]) -> str:
        """
        Render market data as HTML.

        Args:
            market_data: Dictionary with market information.

        Returns:
            HTML string representation.
        """
        html = """
        <div class="market-card">
            <h2>Market Data</h2>
            <table class="market-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
        """

        for symbol, data in market_data.items():
            html += f"""
                    <tr>
                        <td>{symbol}</td>
                        <td>{json.dumps(data)}</td>
                    </tr>
            """

        html += """
                </tbody>
            </table>
        </div>
        """
        return html

    def render_transactions(self, transactions: List[Dict[str, Any]]) -> str:
        """
        Render transaction history as HTML.

        Args:
            transactions: List of transaction records.

        Returns:
            HTML string representation.
        """
        html = """
        <div class="transactions-card">
            <h2>Transaction History</h2>
            <table class="transactions-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Symbol</th>
                        <th>Quantity</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
        """

        for tx in transactions:
            html += f"""
                    <tr>
                        <td>{tx.get('type', 'N/A')}</td>
                        <td>{tx.get('symbol', 'N/A')}</td>
                        <td>{tx.get('quantity', 0)}</td>
                        <td>{tx.get('timestamp', 'N/A')}</td>
                    </tr>
            """

        html += """
                </tbody>
            </table>
        </div>
        """
        return html

    def to_json(self, data: Any) -> str:
        """
        Convert data to JSON string.

        Args:
            data: Data to convert.

        Returns:
            JSON string.
        """
        return json.dumps(data, indent=2)
