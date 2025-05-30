// Assuming React is available globally e.g. via CDN
// Plotly needs to be available globally, e.g., window.Plotly
import { DUKE_BLUE, OREGON_GREEN, STANFORD_CARDINAL_RED, TEXT_COLOR_SECONDARY, PANEL_BACKGROUND } from '../constants.js';

/**
 * @typedef {Object} FMHistoricalPrice
 * @property {string} date
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} FMPPlotlyChartProps
 * @property {FMHistoricalPrice[] | undefined | null} prices
 * @property {string} title
 * @property {string} ticker
 * @property {boolean} isLoading
 */

/**
 * @param {FMPPlotlyChartProps} props
 * @returns {React.ReactElement}
 */
const FMPPlotlyChart = ({ prices, title, ticker, isLoading }) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. FMPPlotlyChart component cannot render.");
    return null; 
  }
  const { useEffect, useRef } = React; // Destructure from global React
  const chartRef = useRef(null);

  useEffect(() => {
    if (!prices || prices.length === 0 || !chartRef.current || !window.Plotly) {
      if(chartRef.current) chartRef.current.innerHTML = ''; // Clear previous chart
      return;
    }

    const trace = {
      x: prices.map(p => p.date),
      open: prices.map(p => p.open),
      high: prices.map(p => p.high),
      low: prices.map(p => p.low),
      close: prices.map(p => p.close),
      increasing: { line: { color: OREGON_GREEN, width: 2 }, fillcolor: OREGON_GREEN+'B3' },
      decreasing: { line: { color: STANFORD_CARDINAL_RED, width: 2 }, fillcolor: STANFORD_CARDINAL_RED+'B3' },
      type: 'candlestick',
      xaxis: 'x',
      yaxis: 'y',
      name: ticker,
    };

    const volumeTrace = {
      x: prices.map(p => p.date),
      y: prices.map(p => p.volume),
      type: 'bar',
      marker: {
        color: prices.map((p, i) => prices[i > 0 ? i-1 : 0].close < p.close ? OREGON_GREEN+'99' : STANFORD_CARDINAL_RED+'99')
      },
      yaxis: 'y2',
      name: 'Volume'
    };

    const layout = {
      dragmode: 'zoom',
      margin: { r: 10, t: 40, b: 40, l: 50 },
      showlegend: false,
      xaxis: {
        autorange: true,
        rangeslider: { visible: false },
        type: 'date',
        tickfont: { color: TEXT_COLOR_SECONDARY, size: 10 },
        gridcolor: '#e5e7eb33',
      },
      yaxis: {
        autorange: true,
        type: 'linear',
        title: { text: 'Price', font: {color: TEXT_COLOR_SECONDARY, size: 10}},
        tickfont: { color: TEXT_COLOR_SECONDARY, size: 10 },
        gridcolor: '#e5e7eb33',
      },
      yaxis2: {
        autorange: true,
        type: 'linear',
        showticklabels: false,
        gridcolor: '#e5e7eb33',
      },
      plot_bgcolor: PANEL_BACKGROUND,
      paper_bgcolor: PANEL_BACKGROUND,
      title: {
        text: title,
        font: { size: 14, color: DUKE_BLUE },
        x: 0.05,
        xanchor: 'left'
      },
      shapes: [],
      annotations: [],
      xaxis_rangeslider_visible: false,
    };

    window.Plotly.newPlot(chartRef.current, [trace, volumeTrace], layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toggleSpikelines'] });

  }, [prices, title, ticker]);

  if (isLoading) {
    return React.createElement(
        'div',
        { className: "flex items-center justify-center h-40 text-sm", style: { color: TEXT_COLOR_SECONDARY } },
        React.createElement('span', { className: "animate-spin rounded-full h-5 w-5 border-b-2 mr-2", style: { borderColor: DUKE_BLUE } }),
        `Loading chart data for ${ticker}...`
    );
  }

  if (!prices || prices.length === 0) {
    return React.createElement(
        'div',
        { className: "flex items-center justify-center h-40 text-sm", style: { color: TEXT_COLOR_SECONDARY } },
        `No historical data available for ${title}.`
    );
  }

  return React.createElement('div', { ref: chartRef, style: { width: '100%', height: '250px' } });
};

export default FMPPlotlyChart;
