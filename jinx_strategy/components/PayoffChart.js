// Assuming React is available globally e.g. via CDN
// Recharts components (LineChart, Line, etc.) also need to be available globally or handled by a module system.
// For pure JS in browser, this means including Recharts via a <script> tag.
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
// import { ChartData } from '../types.js'; // Types are for JSDoc
import { DownloadIcon as ChartDownloadIcon, ChartInfoIcon, DUKE_BLUE, STANFORD_CARDINAL_RED, OREGON_GREEN, TEXT_COLOR_PRIMARY, TEXT_COLOR_SECONDARY, BORDER_COLOR, PANEL_BACKGROUND } from '../constants.js';

/**
 * @typedef {import('../types.js').ChartData} ChartData
 */

/**
 * @typedef {Object} PayoffChartProps
 * @property {ChartData | null} chartData
 * @property {boolean} showIndividualLegs
 */

/**
 * @param {PayoffChartProps} props
 * @returns {React.ReactElement}
 */
const PayoffChart = ({ chartData, showIndividualLegs }) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. PayoffChart component cannot render.");
    return null;
  }
  const { useRef, useEffect, useState, useCallback } = React; // Destructure from global React

  // Ensure Recharts components are available on window or a global Recharts object
  let Recharts;
  if (typeof window !== 'undefined' && window.Recharts) {
    Recharts = window.Recharts;
  } else {
    console.error("Recharts is not loaded. PayoffChart will not render correctly.");
    // Return a fallback or null if Recharts is essential and not loaded
    return React.createElement('div', {}, 'Error: Recharts library not loaded.');
  }
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } = Recharts;


  const chartContainerRef = useRef(null);
  const [prevChartDataRef, setPrevChartDataRef] = useState(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (chartData !== prevChartDataRef) {
      setAnimate(false);
      const timer = setTimeout(() => {
        setAnimate(true);
        setPrevChartDataRef(chartData);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [chartData, prevChartDataRef]);

  const handleDownloadChart = useCallback(() => {
    if (!chartData || !chartContainerRef.current) {
        console.error("Chart data or container not available for download.");
        return;
    }
    const svgElement = chartContainerRef.current.querySelector('svg');
    if (svgElement) {
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      if(!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if(!svgString.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
        svgString = svgString.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Canvas context not available for download.");
        return;
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const svgRect = svgElement.getBoundingClientRect();
        const scaleFactor = 2;
        canvas.width = svgRect.width * scaleFactor;
        canvas.height = svgRect.height * scaleFactor;

        ctx.fillStyle = PANEL_BACKGROUND;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        const fileNameBase = chartData?.underlyingName || 'chart';
        const strategyNamePart = chartData?.strategyTitleShort?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'payoff';
        a.download = `${fileNameBase}_${strategyNamePart}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      img.onerror = (e) => {
        console.error("Error loading SVG image for download:", e);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      console.error("SVG element not found for download.");
    }
  }, [chartData]);

  const yValues = chartData ? [...chartData.totalPayoff] : [];
  if (chartData && showIndividualLegs) {
    chartData.individualLegPayoffs.forEach(legData => yValues.push(...legData));
  }
  let yMin = chartData ? Math.min(...yValues, 0) * 1.1 - (Math.abs(Math.min(...yValues, 0) * 0.1)) : -10;
  let yMax = chartData ? Math.max(...yValues, 0) * 1.1 + (Math.abs(Math.max(...yValues, 0) * 0.1)) : 100;
  if (yMin === 0 && yMax === 0 && chartData) {
    const typicalRange = (chartData.maxProfit !== undefined && chartData.maxLoss !== undefined)
                          ? Math.max(Math.abs(chartData.maxProfit), Math.abs(chartData.maxLoss)) * 0.5
                          : 10;
    yMin = -typicalRange || -10;
    yMax = typicalRange || 10;
  }

  const legColors = ["#2ECC71", "#3498DB", "#E67E22", "#9B59B6", "#F1C40F", "#1ABC9C", "#E74C3C", "#7F8C8D", "#27AE60", DUKE_BLUE];

  const plotData = chartData ? chartData.sTArray.map((sT, index) => {
    const point = {
      s_t: parseFloat(sT.toFixed(2)),
      total_p_l: parseFloat(chartData.totalPayoff[index].toFixed(2)),
    };
    if (showIndividualLegs) {
      chartData.individualLegPayoffs.forEach((legPayoff, legIndex) => {
        point[`leg_${legIndex}_p_l`] = parseFloat(legPayoff[index].toFixed(2));
      });
    }
    return point;
  }) : [];

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return React.createElement(
    'div',
    {
      ref: chartContainerRef,
      className: `relative shadow-xl rounded-xl p-4 sm:p-6 w-full transition-opacity duration-300 ease-in-out ${animate ? 'opacity-100' : 'opacity-0'}`,
      style: { backgroundColor: PANEL_BACKGROUND, height: 'auto', minHeight: '550px' },
      'aria-live': "polite"
    },
    chartData ? React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'div',
        { className: "mb-4" },
        React.createElement(
          'div',
          { className: "flex flex-col sm:flex-row justify-between items-start mb-2" },
          React.createElement(
            'h3',
            { className: "text-lg sm:text-xl font-semibold flex-grow truncate pr-2", style: { color: DUKE_BLUE } },
            `${chartData.underlyingName} Payoff: ${chartData.strategyTitleShort || "Strategy"}`
          ),
          React.createElement(
            'button',
            {
              onClick: handleDownloadChart,
              title: "Download Chart as PNG",
              'aria-label': "Download chart image",
              style: { backgroundColor: DUKE_BLUE },
              className: "mt-2 sm:mt-0 ml-0 sm:ml-2 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-md hover:opacity-90 transition-opacity flex items-center flex-shrink-0"
            },
            React.createElement(ChartDownloadIcon, { className: "w-4 h-4" }),
            React.createElement('span', { className: "ml-1.5 hidden sm:inline" }, "Download Chart")
          )
        ),
        React.createElement(
          'div',
          { className: "grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-xs sm:text-sm py-2", style: { color: TEXT_COLOR_SECONDARY, borderTopColor: BORDER_COLOR, borderBottomColor: BORDER_COLOR, borderTopWidth: '1px', borderBottomWidth: '1px' } },
          React.createElement('div', null, "Max Profit: ", React.createElement('span', { className: "font-semibold", style: { color: OREGON_GREEN } }, formatCurrency(chartData.maxProfit))),
          React.createElement('div', null, "Max Loss: ", React.createElement('span', { className: "font-semibold", style: { color: STANFORD_CARDINAL_RED } }, formatCurrency(chartData.maxLoss))),
          React.createElement('div', null, "Risk/Reward: ", React.createElement('span', { className: "font-semibold", style: { color: DUKE_BLUE } }, typeof chartData.riskRewardRatio === 'number' ? chartData.riskRewardRatio.toFixed(2) : chartData.riskRewardRatio)),
          React.createElement(
            'div',
            { className: "relative has-info-tooltip" },
            "Profit Zone (Plot):",
            React.createElement('span', { className: "font-semibold", style: { color: OREGON_GREEN } }, `${chartData.profitZoneInPlot?.toFixed(1) || 'N/A'}%`),
            React.createElement(ChartInfoIcon, { className: `inline-block ml-1 w-3 h-3 cursor-help text-gray-600` }),
            React.createElement('span', { className: "info-tooltip-text", style: { backgroundColor: DUKE_BLUE } }, "Visual P/L estimate based on the plotted S\u209C range at expiration. Not a model-derived Probability of Profit.")
          )
        )
      ),
      React.createElement(
        ResponsiveContainer,
        { width: "100%", height: 420 },
        React.createElement(
          LineChart,
          { data: plotData, margin: { top: 5, right: 10, left: 20, bottom: 25 } },
          React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: `${BORDER_COLOR}80` }),
          React.createElement(XAxis, {
            dataKey: "s_t",
            type: "number",
            domain: [chartData.minSTPlot, chartData.maxSTPlot],
            label: { value: `${chartData.underlyingName} Price (S\u209C)`, position: 'insideBottom', dy: 15, fill: TEXT_COLOR_SECONDARY, fontSize: '0.8rem' },
            tickFormatter: (tick) => tick.toFixed(Math.abs(tick) < 10 ? 2 : 0),
            stroke: TEXT_COLOR_SECONDARY,
            tick: { fontSize: '0.75rem', fill: TEXT_COLOR_SECONDARY }
          }),
          React.createElement(YAxis, {
            label: { value: 'Profit / Loss ($)', angle: -90, position: 'insideLeft', dx: -25, fill: TEXT_COLOR_SECONDARY, fontSize: '0.8rem' },
            domain: [yMin, yMax],
            tickFormatter: (tick) => tick.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            stroke: TEXT_COLOR_SECONDARY,
            tick: { fontSize: '0.75rem', fill: TEXT_COLOR_SECONDARY },
            width: 75
          }),
          React.createElement(Tooltip, {
            formatter: (value, name) => {
              const formattedValue = value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return [formattedValue, name.startsWith('leg_') && chartData.legDescriptions ? chartData.legDescriptions[parseInt(name.split('_')[1])] : 'Total P/L'];
            },
            labelFormatter: (label) => `${chartData.underlyingName} S\u209C: ${label.toFixed(2)}`,
            contentStyle: { backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: '0.5rem', borderColor: BORDER_COLOR, boxShadow: '0 3px 15px rgba(0,0,0,0.1)', padding: '8px 12px' },
            itemStyle: { color: TEXT_COLOR_PRIMARY, fontSize: '0.8rem' },
            labelStyle: { color: DUKE_BLUE, fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' },
            cursor: { stroke: DUKE_BLUE, strokeWidth: 1.5, strokeDasharray: '4 4' }
          }),
          React.createElement(Legend, { verticalAlign: "top", height: 36, wrapperStyle: { color: TEXT_COLOR_SECONDARY, marginTop: '-10px', fontSize: '0.75rem' } }),
          React.createElement(Line, { type: "monotone", dataKey: "total_p_l", name: "Total P/L", stroke: DUKE_BLUE, strokeWidth: 3, dot: false }),
          showIndividualLegs && chartData.individualLegPayoffs.map((_, index) => React.createElement(Line, {
            key: `leg-${index}`,
            type: "monotone",
            dataKey: `leg_${index}_p_l`,
            name: chartData.legDescriptions[index] || `Leg ${index + 1}`,
            stroke: legColors[index % legColors.length],
            strokeWidth: 1.5,
            strokeDasharray: "5 5",
            dot: false
          })),
          React.createElement(ReferenceLine, { y: 0, stroke: TEXT_COLOR_SECONDARY, strokeDasharray: "3 3", strokeWidth: 1.5 }),
          chartData.currentSNum !== undefined && !isNaN(chartData.currentSNum) && React.createElement(ReferenceLine, {
            x: chartData.currentSNum,
            stroke: OREGON_GREEN,
            strokeWidth: 2,
            label: { value: `S: ${chartData.currentSNum.toFixed(2)}`, position: 'insideTopRight', fill: OREGON_GREEN, dy: -5, dx: 5, fontWeight: 'bold', fontSize: '0.8rem' }
          })
        )
      )
    ) : React.createElement(
      'div',
      { className: "flex items-center justify-center h-full text-lg", style: { color: TEXT_COLOR_SECONDARY } },
      "Generate a plot or fetch AI data to see the chart."
    )
  );
};

export default PayoffChart;
