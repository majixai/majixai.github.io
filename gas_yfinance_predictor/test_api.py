"""
Test script for the YFinance Predictor API
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = 'http://localhost:5000'  # Change this to your deployed URL

def test_health():
    """Test health endpoint"""
    print("\n🏥 Testing Health Endpoint...")
    response = requests.get(f'{BASE_URL}/health')
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.status_code == 200

def test_fetch_ticker(ticker='SPY'):
    """Test fetch ticker data"""
    print(f"\n📊 Testing Fetch Ticker: {ticker}...")
    payload = {
        'ticker': ticker,
        'period': '1mo',
        'interval': '1d'
    }
    response = requests.post(f'{BASE_URL}/api/fetch', json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Ticker: {data['data']['ticker']}")
        print(f"Current Price: ${data['data']['current_price']}")
        print(f"Data Points: {data['data']['data_points']}")
        return data['data']
    else:
        print(f"Error: {response.json()}")
        return None

def test_prediction(ticker='SPY', data=None):
    """Test price prediction"""
    print(f"\n🤖 Testing Prediction: {ticker}...")
    payload = {
        'ticker': ticker,
        'data': data
    }
    response = requests.post(f'{BASE_URL}/api/predict', json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Current Price: ${result['current_price']}")
        print(f"Predicted Price: ${result['predicted_price']}")
        print(f"Change: {result['change_percent']}%")
        print(f"Confidence: {result['confidence']}")
        print(f"Recommendation: {result['recommendation']}")
        return result
    else:
        print(f"Error: {response.json()}")
        return None

def test_report():
    """Test report generation"""
    print("\n📈 Testing Report Generation...")
    payload = {
        'tickers': ['SPY', '^GSPC', '^DJI', 'AAPL', 'MSFT']
    }
    response = requests.post(f'{BASE_URL}/api/generate_report', json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Report generated at: {result['generated_at']}")
        print(f"Tickers analyzed: {len(result['report_data'])}")
        print("\nReport Summary:")
        for item in result['report_data']:
            print(f"  {item['ticker']}: ${item['current_price']} → ${item['predicted_price']} ({item['change_percent']:+.2f}%) - {item['recommendation']}")
        return result
    else:
        print(f"Error: {response.json()}")
        return None

def test_cache(ticker='SPY'):
    """Test cached data retrieval"""
    print(f"\n💾 Testing Cache Retrieval: {ticker}...")
    response = requests.get(f'{BASE_URL}/api/cache/{ticker}')
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Cached data found for {ticker}")
        print(f"Timestamp: {data['data']['timestamp']}")
        return data
    else:
        print(f"No cached data or error: {response.json()}")
        return None

def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("🧪 YFinance Predictor API Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test 1: Health check
    results.append(("Health Check", test_health()))
    
    # Test 2: Fetch ticker data
    ticker_data = test_fetch_ticker('SPY')
    results.append(("Fetch Ticker", ticker_data is not None))
    
    # Test 3: Price prediction
    if ticker_data:
        prediction = test_prediction('SPY', ticker_data)
        results.append(("Price Prediction", prediction is not None))
    else:
        results.append(("Price Prediction", False))
    
    # Test 4: Report generation
    report = test_report()
    results.append(("Report Generation", report is not None))
    
    # Test 5: Cache retrieval
    cache = test_cache('SPY')
    results.append(("Cache Retrieval", cache is not None))
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:.<40} {status}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    return all(passed for _, passed in results)

if __name__ == '__main__':
    try:
        success = run_all_tests()
        exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to server!")
        print(f"Make sure the server is running at {BASE_URL}")
        print("\nTo start the server:")
        print("  python app.py")
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        exit(1)
