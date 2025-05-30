import yfinance as yf
import plotly.graph_objects as go
import pandas as pd

def main():
    # Fetch data for a specific stock
    ticker = "AAPL"
    stock = yf.Ticker(ticker).history(period="1mo")

    # Save the historical data to a CSV file
    stock.to_csv("data.csv")

    # Create an HTML table from the historical data
    stock_html = stock.to_html(classes='w3-table w3-striped w3-bordered', border=0)

    # Create a Plotly graph
    fig = go.Figure(data=[go.Candlestick(x=stock.index,
                                         open=stock['Open'],
                                         high=stock['High'],
                                         low=stock['Low'],
                                         close=stock['Close'])])
    fig.update_layout(title=f'{ticker} Stock Price',
                      yaxis_title='Price (USD)',
                      xaxis_title='Date')
    graph_html = fig.to_html(full_html=False)

    # Combine the HTML table and the Plotly graph into one HTML file
    with open("jinx/index.html", "w") as f:
        f.write(f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YFinance Data</title>
            <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        </head>
        <body onload="renderGraph()">
            <h1 class="w3-center">YFinance Data for {ticker}</h1>
            <div class="w3-container">
                {stock_html}
            </div>
            <div class="w3-container" id="graph-container">
                {graph_html}
            </div>
            <script>
                function renderGraph() {{
                    var graphContainer = document.getElementById('graph-container');
                    graphContainer.innerHTML = `{graph_html}`;
                }}
            </script>
        </body>
        </html>
        """)

if __name__ == "__main__":
    main()
