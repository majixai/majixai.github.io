// services/externalApiService.js

// Assuming types.js is in the parent directory and has .js extension
// JSDoc types will be used for type hinting.

const POLYGON_API_BASE_URL = "https://api.polygon.io"; // Example base URL

/**
 * Fetches stock aggregate data from an external API (e.g., Polygon.io).
 * IMPORTANT: This function assumes POLY_API_KEY is available via process.env.
 * Using API keys directly on the client-side is a security risk for production applications.
 * Ensure the target API supports CORS for client-side requests.
 *
 * @param {string} ticker The stock ticker symbol.
 * @param {number} multiplier The size of the timespan multiplier.
 * @param {string} timespan The timespan for aggregates (e.g., "minute", "hour", "day").
 * @param {string} from The start date for aggregates (YYYY-MM-DD).
 * @param {string} to The end date for aggregates (YYYY-MM-DD).
 * @param {number} [limit=5000] The maximum number of base aggregates to aggregate.
 * @returns {Promise<import('../types.js').PolygonAggregateResponse | { error: string }>} A promise that resolves to the API response or an error object.
 */
export async function fetchStockAggregates(
  ticker,
  multiplier,
  timespan,
  from,
  to,
  limit = 5000
) {
  // In a pure client-side JavaScript environment without a build process,
  // process.env.POLY_API_KEY will not be available.
  // API keys should be handled securely, perhaps fetched from a backend or a config file
  // that is not committed to version control.
  // For this refactor, we'll log an error if it's not available,
  // but a real application would need a more robust solution.
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.POLY_API_KEY) ? process.env.POLY_API_KEY : null;

  if (!apiKey) {
    const DUMMY_KEY_FOR_DEV = "YOUR_POLYGON_API_KEY"; // Replace with a real key for local dev if needed, but DO NOT COMMIT
    console.warn(
        `External API Key (POLY_API_KEY) is not configured. ` +
        `Client-side API key exposure is a security risk. ` +
        `For development, you might temporarily set it in your environment or a non-committed config. ` +
        `Using DUMMY_KEY_FOR_DEV: ${DUMMY_KEY_FOR_DEV ? 'Yes (placeholder)' : 'No (will fail)'}`
    );
    // To make it runnable for demonstration without an env var, you might use a placeholder or a test key.
    // However, for a real application, this is a significant security concern.
    // apiKey = DUMMY_KEY_FOR_DEV; // Uncomment for local testing if you replace DUMMY_KEY_FOR_DEV
    if (!DUMMY_KEY_FOR_DEV && !apiKey) { // If still no key after considering a dummy one.
        return { error: "External API Key (POLY_API_KEY) is not configured. This is a security risk to set directly in client-side code for production." };
    }
  }

  // Example URL structure for Polygon.io aggregates
  const url = `${POLYGON_API_BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}` // Or your chosen dummy/test key
        // Add other headers if required by the API
      }
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON or fails to parse
        return { error: `External API request failed for ${ticker} with status ${response.status}: ${response.statusText}` };
      }
      // Try to extract a more specific error message from the API's JSON response
      const errorMessage = errorData?.message || errorData?.error || `External API request failed for ${ticker} with status ${response.status}`;
      console.error(`External API Error (${response.status}) for ${ticker}:`, errorMessage, errorData);
      return { error: `External API Error (${ticker}): ${errorMessage}` };
    }

    const data = await response.json();

    // Some APIs might return a 200 OK but still have an error in the body
    if (data.status === "ERROR" || data.error) {
        console.error(`External API returned an error status for ${ticker}:`, data.error || data.status);
        return { error: `External API Error (${ticker}): ${data.error || "Unknown error from API status."}` };
    }
    
    return data;

  } catch (error) {
    console.error(`Network or parsing error fetching external data for ${ticker}:`, error);
    const message = error instanceof Error ? error.message : `Unknown network error during fetch for ${ticker}.`;
    return { error: `Network error with External API (${ticker}): ${message}` };
  }
}

// Example of how this might be called (commented out as it's illustrative):
/*
async function exampleUsage() {
  const tickerData = await fetchStockAggregates("AAPL", 1, "day", "2023-01-01", "2023-01-10");
  if ('error' in tickerData) {
    console.error("Failed to fetch AAPL data:", tickerData.error);
  } else {
    console.log("AAPL Data:", tickerData.results); // Assuming 'results' is part of PolygonAggregateResponse
  }
}
*/
