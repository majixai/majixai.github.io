// jsPDF needs to be available globally, e.g., via CDN.
// const { jsPDF } = jspdf; // This line is problematic for no-build browser JS.
// We'll assume `window.jspdf.jsPDF` exists.

import { formatDate, formatPrice } from './miscUtils.js'; // Assuming .js extension

/**
 * @param {import('../types.js').StockInsightModalData} data
 * @returns {string}
 */
export const generateMarkdownFromInsightData = (data) => {
    const { suggestion, isHistorical, deepDiveAnalysis } = data;
    const ticker = suggestion.ticker.toUpperCase();
    const currentPrice = isHistorical
        ? /** @type {import('../types.js').HistoricalBullishSuggestionEntry} */ (suggestion).priceAtSuggestion
        : /** @type {import('../types.js').StoredBullishStockSuggestion} */ (suggestion).currentPrice;

    let md = `# Stock Analysis: ${ticker}\n\n`;
    md += `**Ticker:** ${ticker}\n`;
    md += `**Price at Suggestion/Analysis:** ${formatPrice(currentPrice)}\n`;
    if (isHistorical) {
        md += `**Suggestion Date (Historical):** ${formatDate(/** @type {import('../types.js').HistoricalBullishSuggestionEntry} */ (suggestion).initialTimestamp)}\n`;
    } else {
        md += `**Suggestion Date (Current):** ${formatDate(/** @type {import('../types.js').StoredBullishStockSuggestion} */ (suggestion).timestamp)}\n`;
    }
    md += `**Outlook Horizon:** ${suggestion.outlookHorizon}\n`;
    md += `**Price Category:** ${suggestion.priceCategory}\n\n`;

    md += `## Initial Suggestion\n`;
    if (suggestion.reasoning) {
        md += `**Reasoning:**\n${suggestion.reasoning}\n\n`;
    }
    if (suggestion.projectedPriceChangePercentMin !== undefined && suggestion.projectedPriceChangePercentMax !== undefined) {
        md += `**Projected Price Change:** ${suggestion.projectedPriceChangePercentMin}% to ${suggestion.projectedPriceChangePercentMax}%\n`;
    }
    if (suggestion.projectedTimeline) {
        md += `**Projected Timeline:** ${suggestion.projectedTimeline}\n`;
    }
    md += `\n`;

    if (deepDiveAnalysis) {
        md += `## Deeper Analysis (Timestamp: ${formatDate(deepDiveAnalysis.analysisTimestamp)})\n\n`;
        if (deepDiveAnalysis.dataComment) {
            md += `**AI Data Comment:**\n${deepDiveAnalysis.dataComment}\n\n`;
        }
        if (deepDiveAnalysis.detailedReasoning) {
            md += `**Detailed Reasoning:**\n${deepDiveAnalysis.detailedReasoning}\n\n`;
        }

        if (deepDiveAnalysis.currentChartPatterns && deepDiveAnalysis.currentChartPatterns.length > 0) {
            md += `### Current Intraday Chart Patterns\n`;
            deepDiveAnalysis.currentChartPatterns.forEach(p => {
                md += `- **${p.patternName || 'N/A'}** (${p.timeframe || 'N/A'})\n`;
                md += `  - Status: ${p.status || 'N/A'}\n`;
                if (p.keyLevels) md += `  - Key Levels: ${p.keyLevels}\n`;
                if (p.description) md += `  - Description: ${p.description}\n`;
            });
            md += `\n`;
        }

        if (deepDiveAnalysis.barPlayAnalysis && deepDiveAnalysis.barPlayAnalysis.length > 0) {
            md += `### Short-Term Bar Play Analysis\n`;
            deepDiveAnalysis.barPlayAnalysis.forEach(p => {
                md += `- **${p.playType || 'N/A'}** (${p.relevantTimeframe || 'N/A'})\n`;
                md += `  - Outcome: ${p.outcome || 'N/A'} (Confidence: ${p.confidence || 'N/A'})\n`;
                if (p.description) md += `  - Description: ${p.description}\n`;
            });
            md += `\n`;
        }

        if (deepDiveAnalysis.priceProjectionDetails && deepDiveAnalysis.priceProjectionDetails.length > 0) {
            md += `### Price Projection Details\n`;
            deepDiveAnalysis.priceProjectionDetails.forEach(p => {
                md += `- Target: ${formatPrice(p.targetPrice)} (+${p.projectedPriceChangePercent.toFixed(1)}%)\n`;
                md += `  - Timeline: ${p.timelineDetail} (Probability: ${p.probabilityEstimate || 'N/A'})\n`;
                if (p.reasoning) md += `  - Reasoning: ${p.reasoning}\n`;
                if (p.stdDevLevels) {
                    md += `  - Std Dev Levels: L1 Up: ${formatPrice(p.stdDevLevels.level1up)}, L1 Down: ${formatPrice(p.stdDevLevels.level1down)}, L2 Up: ${formatPrice(p.stdDevLevels.level2up)}, L2 Down: ${formatPrice(p.stdDevLevels.level2down)}\n`;
                }
            });
            md += `\n`;
        }

        if (deepDiveAnalysis.microstructureInsights) {
            md += `**Microstructure Insights:**\n${deepDiveAnalysis.microstructureInsights}\n\n`;
        }
        if (deepDiveAnalysis.covarianceConsiderations) {
            md += `**Covariance Considerations:**\n${deepDiveAnalysis.covarianceConsiderations}\n\n`;
        }
        if (deepDiveAnalysis.advancedModelReferences) {
            md += `**Advanced Model References:**\n${deepDiveAnalysis.advancedModelReferences}\n\n`;
        }

        if (deepDiveAnalysis.sources && deepDiveAnalysis.sources.length > 0) {
            md += `### AI Sources\n`;
            deepDiveAnalysis.sources.forEach(s => {
                md += `- [${s.title || new URL(s.uri).hostname}](${s.uri})\n`;
            });
            md += `\n`;
        }
    }
    return md;
};

/**
 * @param {import('../types.js').StockInsightModalData} data
 * @returns {Promise<void>}
 */
export const generatePdfFromInsightData = async (data) => {
    if (typeof window === 'undefined' || !window.jspdf || !window.jspdf.jsPDF) {
        console.error("jsPDF not found on window.jspdf.jsPDF. Please include it via CDN.");
        alert("PDF generation library is not loaded. Please check console.");
        return;
    }
    const { jsPDF } = window.jspdf;

    const { suggestion, isHistorical, deepDiveAnalysis } = data;
    const ticker = suggestion.ticker.toUpperCase();
    const currentPrice = isHistorical
        ? /** @type {import('../types.js').HistoricalBullishSuggestionEntry} */ (suggestion).priceAtSuggestion
        : /** @type {import('../types.js').StoredBullishStockSuggestion} */ (suggestion).currentPrice;

    const doc = new jsPDF();
    let yPos = 15;
    const pageHeight = doc.internal.pageSize.height;
    const leftMargin = 15;
    const rightMargin = doc.internal.pageSize.width - 15;
    const lineHeight = 7;
    const sectionSpacing = 10;
    const subsectionSpacing = 5;

    const checkYPos = (lines = 1) => {
        if (yPos + (lines * lineHeight) > pageHeight - 20) { // 20mm bottom margin
            doc.addPage();
            yPos = 15;
        }
    };

    /**
     * @param {string} text
     * @param {number} size
     * @param {boolean} [isBold=false]
     * @param {number} [xOverride]
     * @param {boolean} [wrap=true]
     */
    const addText = (text, size, isBold = false, xOverride, wrap = true) => {
        checkYPos();
        doc.setFontSize(size);
        doc.setFont(undefined, isBold ? 'bold' : 'normal');
        const textLines = wrap ? doc.splitTextToSize(text, (xOverride || rightMargin) - (xOverride || leftMargin)) : [text];
        doc.text(textLines, xOverride || leftMargin, yPos);
        yPos += textLines.length * (lineHeight * (size / 12)); // Adjust line height based on font size
    };

    /** @param {string} title */
    const addSectionTitle = (title) => {
        checkYPos(2);
        yPos += subsectionSpacing;
        addText(title, 14, true);
        yPos += lineHeight * 0.5;
    };

    /** @param {string} title */
    const addSubSectionTitle = (title) => {
        checkYPos(1.5);
        yPos += subsectionSpacing * 0.5;
        addText(title, 11, true);
        yPos += lineHeight * 0.3;
    };

    /** @param {string} text */
    const addListItem = (text) => {
        checkYPos();
        addText(`• ${text}`, 10, false, leftMargin + 5);
    };

    addText(`Stock Analysis: ${ticker}`, 18, true);
    yPos += sectionSpacing;

    addText(`Ticker: ${ticker}`, 10);
    addText(`Price at Suggestion/Analysis: ${formatPrice(currentPrice)}`, 10);
    if (isHistorical) {
        addText(`Suggestion Date (Historical): ${formatDate(/** @type {import('../types.js').HistoricalBullishSuggestionEntry} */ (suggestion).initialTimestamp)}`, 10);
    } else {
        addText(`Suggestion Date (Current): ${formatDate(/** @type {import('../types.js').StoredBullishStockSuggestion} */ (suggestion).timestamp)}`, 10);
    }
    addText(`Outlook Horizon: ${suggestion.outlookHorizon}`, 10);
    addText(`Price Category: ${suggestion.priceCategory}`, 10);
    yPos += sectionSpacing;

    addSectionTitle("Initial Suggestion");
    if (suggestion.reasoning) {
        addSubSectionTitle("Reasoning:");
        addText(suggestion.reasoning, 10);
    }
    if (suggestion.projectedPriceChangePercentMin !== undefined && suggestion.projectedPriceChangePercentMax !== undefined) {
        addText(`Projected Price Change: ${suggestion.projectedPriceChangePercentMin}% to ${suggestion.projectedPriceChangePercentMax}%`, 10);
    }
    if (suggestion.projectedTimeline) {
        addText(`Projected Timeline: ${suggestion.projectedTimeline}`, 10);
    }
    yPos += sectionSpacing;

    if (deepDiveAnalysis) {
        addSectionTitle(`Deeper Analysis (Timestamp: ${formatDate(deepDiveAnalysis.analysisTimestamp)})`);
        if (deepDiveAnalysis.dataComment) {
            addSubSectionTitle("AI Data Comment:");
            addText(deepDiveAnalysis.dataComment, 10);
            yPos += subsectionSpacing;
        }
        if (deepDiveAnalysis.detailedReasoning) {
            addSubSectionTitle("Detailed Reasoning:");
            addText(deepDiveAnalysis.detailedReasoning, 10);
            yPos += subsectionSpacing;
        }

        if (deepDiveAnalysis.currentChartPatterns && deepDiveAnalysis.currentChartPatterns.length > 0) {
            addSubSectionTitle("Current Intraday Chart Patterns:");
            deepDiveAnalysis.currentChartPatterns.forEach(p => {
                addListItem(`${p.patternName || 'N/A'} (${p.timeframe || 'N/A'})`);
                yPos -= lineHeight * 0.4;
                addText(`  Status: ${p.status || 'N/A'}`, 9, false, leftMargin + 10);
                if (p.keyLevels) addText(`  Key Levels: ${p.keyLevels}`, 9, false, leftMargin + 10);
                if (p.description) addText(`  Description: ${p.description}`, 9, false, leftMargin + 10);
            });
            yPos += subsectionSpacing;
        }

        if (deepDiveAnalysis.barPlayAnalysis && deepDiveAnalysis.barPlayAnalysis.length > 0) {
            addSubSectionTitle("Short-Term Bar Play Analysis:");
            deepDiveAnalysis.barPlayAnalysis.forEach(p => {
                addListItem(`${p.playType || 'N/A'} (${p.relevantTimeframe || 'N/A'})`);
                 yPos -= lineHeight * 0.4;
                addText(`  Outcome: ${p.outcome || 'N/A'} (Confidence: ${p.confidence || 'N/A'})`, 9, false, leftMargin + 10);
                if (p.description) addText(`  Description: ${p.description}`, 9, false, leftMargin + 10);
            });
            yPos += subsectionSpacing;
        }

        if (deepDiveAnalysis.priceProjectionDetails && deepDiveAnalysis.priceProjectionDetails.length > 0) {
            addSubSectionTitle("Price Projection Details:");
            deepDiveAnalysis.priceProjectionDetails.forEach(p => {
                addListItem(`Target: ${formatPrice(p.targetPrice)} (+${p.projectedPriceChangePercent.toFixed(1)}%)`);
                yPos -= lineHeight * 0.4;
                addText(`  Timeline: ${p.timelineDetail} (Probability: ${p.probabilityEstimate || 'N/A'})`, 9, false, leftMargin + 10);
                if (p.reasoning) addText(`  Reasoning: ${p.reasoning}`, 9, false, leftMargin + 10);
                 if (p.stdDevLevels) {
                    addText(`  Std Dev Levels: L1 Up: ${formatPrice(p.stdDevLevels.level1up)}, L1 Down: ${formatPrice(p.stdDevLevels.level1down)}, L2 Up: ${formatPrice(p.stdDevLevels.level2up)}, L2 Down: ${formatPrice(p.stdDevLevels.level2down)}`, 9, false, leftMargin + 10);
                }
            });
            yPos += subsectionSpacing;
        }

        if (deepDiveAnalysis.microstructureInsights) {
            addSubSectionTitle("Microstructure Insights:");
            addText(deepDiveAnalysis.microstructureInsights, 10);
            yPos += subsectionSpacing;
        }
        if (deepDiveAnalysis.covarianceConsiderations) {
            addSubSectionTitle("Covariance Considerations:");
            addText(deepDiveAnalysis.covarianceConsiderations, 10);
            yPos += subsectionSpacing;
        }
        if (deepDiveAnalysis.advancedModelReferences) {
            addSubSectionTitle("Advanced Model References:");
            addText(deepDiveAnalysis.advancedModelReferences, 10);
            yPos += subsectionSpacing;
        }

        if (deepDiveAnalysis.sources && deepDiveAnalysis.sources.length > 0) {
            addSubSectionTitle("AI Sources:");
            deepDiveAnalysis.sources.forEach(s => {
                 checkYPos();
                 doc.setFontSize(9);
                 doc.setTextColor(0, 0, 255);
                 doc.textWithLink(s.title || new URL(s.uri).hostname, leftMargin + 5, yPos, { url: s.uri });
                 doc.setTextColor(0, 0, 0);
                 yPos += lineHeight * 0.8;
            });
        }
    }

    doc.save(`${ticker}_StockAnalysis_${new Date().toISOString().split('T')[0]}.pdf`);
};
