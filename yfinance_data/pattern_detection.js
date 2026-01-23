/**
 * Advanced Pattern Detection with Visual Overlays
 * Includes entry/exit points and geometric shape rendering
 */

const PatternDetection = {
    
    /**
     * Detect all chart patterns with coordinates for visualization
     */
    detectAllPatterns(tickerData) {
        const patterns = [];
        
        patterns.push(...this.detectTriangles(tickerData));
        patterns.push(...this.detectPennants(tickerData));
        patterns.push(...this.detectRectangles(tickerData));
        patterns.push(...this.detectHeadAndShoulders(tickerData));
        patterns.push(...this.detectDoubleTops(tickerData));
        patterns.push(...this.detectDoubleBottoms(tickerData));
        patterns.push(...this.detectCupAndHandle(tickerData));
        patterns.push(...this.detectWedges(tickerData));
        
        return patterns;
    },
    
    /**
     * ASCENDING TRIANGLE
     * Bullish continuation pattern
     */
    detectTriangles(data) {
        const patterns = [];
        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);
        const dates = data.map(d => d.date);
        
        const windowSize = 20;
        
        for (let i = windowSize; i < data.length - 10; i++) {
            const window = prices.slice(i - windowSize, i);
            const highWindow = highs.slice(i - windowSize, i);
            const lowWindow = lows.slice(i - windowSize, i);
            
            // Find peaks and troughs
            const peaks = this.findPeaks(highWindow);
            const troughs = this.findTroughs(lowWindow);
            
            if (peaks.length >= 3 && troughs.length >= 2) {
                // Check for ascending triangle (flat top, rising bottom)
                const peakPrices = peaks.map(p => highWindow[p]);
                const troughPrices = troughs.map(t => lowWindow[t]);
                
                const peakSlope = this.calculateSlope(peaks, peakPrices);
                const troughSlope = this.calculateSlope(troughs, troughPrices);
                
                // Ascending triangle: flat top (-0.001 < slope < 0.001), rising bottom (slope > 0.005)
                if (Math.abs(peakSlope) < 0.001 && troughSlope > 0.005) {
                    const resistance = Math.max(...peakPrices);
                    const currentPrice = prices[i];
                    const breakoutTarget = resistance + (resistance - Math.min(...troughPrices)) * 0.618;
                    const stopLoss = Math.min(...troughPrices.slice(-2));
                    
                    patterns.push({
                        type: 'ascending_triangle',
                        name: 'Ascending Triangle',
                        shape: 'triangle',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        resistance: resistance,
                        support: troughPrices[troughPrices.length - 1],
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: stopLoss,
                        entryPoint: resistance * 1.002, // 0.2% above resistance
                        exitPoint: breakoutTarget,
                        riskReward: (breakoutTarget - resistance) / (resistance - stopLoss),
                        confidence: 75,
                        direction: 'bullish',
                        description: `Ascending Triangle detected. Flat resistance at $${resistance.toFixed(2)} with rising support. ` +
                                   `Entry: Break above $${(resistance * 1.002).toFixed(2)} | ` +
                                   `Target: $${breakoutTarget.toFixed(2)} | Stop: $${stopLoss.toFixed(2)}`,
                        coordinates: {
                            topLine: [
                                { x: dates[i - windowSize + peaks[0]], y: highWindow[peaks[0]] },
                                { x: dates[i - 1], y: resistance }
                            ],
                            bottomLine: [
                                { x: dates[i - windowSize + troughs[0]], y: lowWindow[troughs[0]] },
                                { x: dates[i - windowSize + troughs[troughs.length - 1]], y: troughPrices[troughPrices.length - 1] }
                            ]
                        }
                    });
                }
                
                // Descending triangle: rising top, flat bottom
                if (peakSlope < -0.005 && Math.abs(troughSlope) < 0.001) {
                    const support = Math.min(...troughPrices);
                    const currentPrice = prices[i];
                    const breakoutTarget = support - (Math.max(...peakPrices) - support) * 0.618;
                    const stopLoss = Math.max(...peakPrices.slice(-2));
                    
                    patterns.push({
                        type: 'descending_triangle',
                        name: 'Descending Triangle',
                        shape: 'triangle',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        resistance: peakPrices[peakPrices.length - 1],
                        support: support,
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: stopLoss,
                        entryPoint: support * 0.998,
                        exitPoint: breakoutTarget,
                        riskReward: (support - breakoutTarget) / (stopLoss - support),
                        confidence: 72,
                        direction: 'bearish',
                        description: `Descending Triangle detected. Flat support at $${support.toFixed(2)} with declining resistance. ` +
                                   `Entry: Break below $${(support * 0.998).toFixed(2)} | ` +
                                   `Target: $${breakoutTarget.toFixed(2)} | Stop: $${stopLoss.toFixed(2)}`,
                        coordinates: {
                            topLine: [
                                { x: dates[i - windowSize + peaks[0]], y: peakPrices[0] },
                                { x: dates[i - windowSize + peaks[peaks.length - 1]], y: peakPrices[peakPrices.length - 1] }
                            ],
                            bottomLine: [
                                { x: dates[i - windowSize + troughs[0]], y: support },
                                { x: dates[i - 1], y: support }
                            ]
                        }
                    });
                }
                
                // Symmetrical triangle
                if (peakSlope < -0.003 && troughSlope > 0.003) {
                    const apex = this.calculateApex(peaks, peakPrices, troughs, troughPrices);
                    const currentPrice = prices[i];
                    const height = Math.max(...peakPrices) - Math.min(...troughPrices);
                    const breakoutTargetUp = currentPrice + height * 0.618;
                    const breakoutTargetDown = currentPrice - height * 0.618;
                    
                    patterns.push({
                        type: 'symmetrical_triangle',
                        name: 'Symmetrical Triangle',
                        shape: 'triangle',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        apex: apex,
                        currentPrice: currentPrice,
                        breakoutTargetUp: breakoutTargetUp,
                        breakoutTargetDown: breakoutTargetDown,
                        stopLoss: currentPrice * 0.97,
                        entryPoint: currentPrice * 1.005,
                        exitPoint: breakoutTargetUp,
                        riskReward: 2.0,
                        confidence: 68,
                        direction: 'neutral',
                        description: `Symmetrical Triangle forming. Converging trendlines indicate breakout imminent. ` +
                                   `Bullish Entry: $${(currentPrice * 1.005).toFixed(2)} → Target: $${breakoutTargetUp.toFixed(2)} | ` +
                                   `Bearish Entry: $${(currentPrice * 0.995).toFixed(2)} → Target: $${breakoutTargetDown.toFixed(2)}`,
                        coordinates: {
                            topLine: [
                                { x: dates[i - windowSize + peaks[0]], y: peakPrices[0] },
                                { x: dates[i + 5] || dates[i], y: apex }
                            ],
                            bottomLine: [
                                { x: dates[i - windowSize + troughs[0]], y: troughPrices[0] },
                                { x: dates[i + 5] || dates[i], y: apex }
                            ]
                        }
                    });
                }
            }
        }
        
        return patterns;
    },
    
    /**
     * PENNANTS
     * Short-term continuation patterns
     */
    detectPennants(data) {
        const patterns = [];
        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);
        const dates = data.map(d => d.date);
        const volumes = data.map(d => d.volume);
        
        const windowSize = 10; // Pennants are shorter than triangles
        
        for (let i = windowSize + 5; i < data.length - 5; i++) {
            // Look for strong move (flagpole) before pennant
            const flagpoleStart = i - windowSize - 5;
            const flagpoleEnd = i - windowSize;
            const flagpoleMove = (prices[flagpoleEnd] - prices[flagpoleStart]) / prices[flagpoleStart];
            
            if (Math.abs(flagpoleMove) > 0.08) { // 8% move for flagpole
                const window = prices.slice(i - windowSize, i);
                const highWindow = highs.slice(i - windowSize, i);
                const lowWindow = lows.slice(i - windowSize, i);
                const volWindow = volumes.slice(i - windowSize, i);
                
                // Check for decreasing volatility and volume
                const earlyVol = this.calculateVolatility(window.slice(0, 5));
                const lateVol = this.calculateVolatility(window.slice(-5));
                const avgEarlyVolume = volWindow.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
                const avgLateVolume = volWindow.slice(-5).reduce((a, b) => a + b, 0) / 5;
                
                if (lateVol < earlyVol * 0.7 && avgLateVolume < avgEarlyVolume * 0.8) {
                    const currentPrice = prices[i];
                    const pennantHeight = Math.max(...highWindow) - Math.min(...lowWindow);
                    const flagpoleHeight = Math.abs(prices[flagpoleEnd] - prices[flagpoleStart]);
                    const projectedMove = flagpoleHeight;
                    
                    const isBullish = flagpoleMove > 0;
                    const breakoutTarget = isBullish ? 
                        currentPrice + projectedMove : 
                        currentPrice - projectedMove;
                    const stopLoss = isBullish ?
                        Math.min(...lowWindow) :
                        Math.max(...highWindow);
                    
                    patterns.push({
                        type: isBullish ? 'bullish_pennant' : 'bearish_pennant',
                        name: isBullish ? 'Bullish Pennant' : 'Bearish Pennant',
                        shape: 'pennant',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        flagpoleStart: prices[flagpoleStart],
                        flagpoleEnd: prices[flagpoleEnd],
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: stopLoss,
                        entryPoint: isBullish ? currentPrice * 1.003 : currentPrice * 0.997,
                        exitPoint: breakoutTarget,
                        riskReward: Math.abs(breakoutTarget - currentPrice) / Math.abs(currentPrice - stopLoss),
                        confidence: 80,
                        direction: isBullish ? 'bullish' : 'bearish',
                        description: `${isBullish ? 'Bullish' : 'Bearish'} Pennant after ${(flagpoleMove * 100).toFixed(1)}% move. ` +
                                   `Consolidation indicates continuation. Entry: $${(isBullish ? currentPrice * 1.003 : currentPrice * 0.997).toFixed(2)} | ` +
                                   `Target: $${breakoutTarget.toFixed(2)} (${(projectedMove / currentPrice * 100).toFixed(1)}% move) | ` +
                                   `Stop: $${stopLoss.toFixed(2)}`,
                        coordinates: {
                            flagpole: [
                                { x: dates[flagpoleStart], y: prices[flagpoleStart] },
                                { x: dates[flagpoleEnd], y: prices[flagpoleEnd] }
                            ],
                            topLine: [
                                { x: dates[i - windowSize], y: highWindow[0] },
                                { x: dates[i], y: currentPrice + pennantHeight * 0.2 }
                            ],
                            bottomLine: [
                                { x: dates[i - windowSize], y: lowWindow[0] },
                                { x: dates[i], y: currentPrice - pennantHeight * 0.2 }
                            ]
                        }
                    });
                }
            }
        }
        
        return patterns;
    },
    
    /**
     * RECTANGLES (Trading Ranges)
     * Horizontal support and resistance
     */
    detectRectangles(data) {
        const patterns = [];
        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);
        const dates = data.map(d => d.date);
        
        const windowSize = 20;
        
        for (let i = windowSize; i < data.length - 10; i++) {
            const highWindow = highs.slice(i - windowSize, i);
            const lowWindow = lows.slice(i - windowSize, i);
            
            const resistance = Math.max(...highWindow);
            const support = Math.min(...lowWindow);
            const range = resistance - support;
            const midpoint = (resistance + support) / 2;
            
            // Check if price stays within range (rectangle)
            const touchesTop = highWindow.filter(h => Math.abs(h - resistance) < range * 0.02).length;
            const touchesBottom = lowWindow.filter(l => Math.abs(l - support) < range * 0.02).length;
            
            if (touchesTop >= 2 && touchesBottom >= 2 && range / midpoint > 0.03 && range / midpoint < 0.15) {
                const currentPrice = prices[i];
                const breakoutTargetUp = resistance + range;
                const breakoutTargetDown = support - range;
                const position = (currentPrice - support) / range;
                
                patterns.push({
                    type: 'rectangle',
                    name: 'Rectangle (Trading Range)',
                    shape: 'rectangle',
                    startIndex: i - windowSize,
                    endIndex: i,
                    startDate: dates[i - windowSize],
                    endDate: dates[i],
                    resistance: resistance,
                    support: support,
                    midpoint: midpoint,
                    range: range,
                    currentPrice: currentPrice,
                    position: position * 100, // % from bottom
                    breakoutTargetUp: breakoutTargetUp,
                    breakoutTargetDown: breakoutTargetDown,
                    entryPoint: position > 0.7 ? support * 1.005 : resistance * 0.995,
                    exitPoint: position > 0.7 ? support : resistance,
                    stopLoss: position > 0.7 ? support * 0.995 : resistance * 1.005,
                    riskReward: 1.5,
                    confidence: 70,
                    direction: 'neutral',
                    description: `Rectangle pattern with ${touchesTop + touchesBottom} touches. ` +
                                `Range: $${support.toFixed(2)} - $${resistance.toFixed(2)} (${(range / midpoint * 100).toFixed(1)}%). ` +
                                `Current position: ${(position * 100).toFixed(0)}% from bottom. ` +
                                `Buy Support: $${support.toFixed(2)} → Sell: $${(support + range * 0.8).toFixed(2)} | ` +
                                `Short Resistance: $${resistance.toFixed(2)} → Cover: $${(resistance - range * 0.8).toFixed(2)}`,
                    coordinates: {
                        corners: [
                            { x: dates[i - windowSize], y: resistance },
                            { x: dates[i], y: resistance },
                            { x: dates[i], y: support },
                            { x: dates[i - windowSize], y: support }
                        ]
                    }
                });
            }
        }
        
        return patterns;
    },
    
    /**
     * HEAD AND SHOULDERS
     * Reversal pattern
     */
    detectHeadAndShoulders(data) {
        const patterns = [];
        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const dates = data.map(d => d.date);
        
        const windowSize = 30;
        
        for (let i = windowSize; i < data.length - 10; i++) {
            const window = highs.slice(i - windowSize, i);
            const peaks = this.findPeaks(window);
            
            if (peaks.length >= 3) {
                const peakValues = peaks.map(p => window[p]);
                
                // Check for head and shoulders: shoulder1 < head > shoulder2
                for (let j = 0; j < peaks.length - 2; j++) {
                    const s1 = peakValues[j];
                    const head = peakValues[j + 1];
                    const s2 = peakValues[j + 2];
                    
                    if (head > s1 * 1.03 && head > s2 * 1.03 && Math.abs(s1 - s2) / s1 < 0.05) {
                        // Find neckline (support between shoulders)
                        const necklineStart = Math.min(...window.slice(peaks[j], peaks[j + 1]));
                        const necklineEnd = Math.min(...window.slice(peaks[j + 1], peaks[j + 2]));
                        const neckline = (necklineStart + necklineEnd) / 2;
                        
                        const currentPrice = prices[i];
                        const headHeight = head - neckline;
                        const breakoutTarget = neckline - headHeight;
                        
                        patterns.push({
                            type: 'head_and_shoulders',
                            name: 'Head and Shoulders',
                            shape: 'complex',
                            startIndex: i - windowSize + peaks[j],
                            endIndex: i - windowSize + peaks[j + 2],
                            startDate: dates[i - windowSize + peaks[j]],
                            endDate: dates[i - windowSize + peaks[j + 2]],
                            leftShoulder: s1,
                            head: head,
                            rightShoulder: s2,
                            neckline: neckline,
                            currentPrice: currentPrice,
                            breakoutTarget: breakoutTarget,
                            stopLoss: head * 1.02,
                            entryPoint: neckline * 0.998,
                            exitPoint: breakoutTarget,
                            riskReward: (neckline - breakoutTarget) / (head - neckline),
                            confidence: 82,
                            direction: 'bearish',
                            description: `Head and Shoulders reversal pattern. Left Shoulder: $${s1.toFixed(2)}, Head: $${head.toFixed(2)}, Right Shoulder: $${s2.toFixed(2)}. ` +
                                       `Neckline at $${neckline.toFixed(2)}. Entry: Break below $${(neckline * 0.998).toFixed(2)} | ` +
                                       `Target: $${breakoutTarget.toFixed(2)} (${(headHeight / neckline * 100).toFixed(1)}% decline) | Stop: $${(head * 1.02).toFixed(2)}`,
                            coordinates: {
                                shoulders: [
                                    { x: dates[i - windowSize + peaks[j]], y: s1 },
                                    { x: dates[i - windowSize + peaks[j + 2]], y: s2 }
                                ],
                                head: { x: dates[i - windowSize + peaks[j + 1]], y: head },
                                neckline: [
                                    { x: dates[i - windowSize + peaks[j]], y: neckline },
                                    { x: dates[i - windowSize + peaks[j + 2]], y: neckline }
                                ]
                            }
                        });
                    }
                }
            }
        }
        
        return patterns;
    },
    
    /**
     * DOUBLE TOPS/BOTTOMS
     */
    detectDoubleTops(data) {
        const patterns = [];
        const highs = data.map(d => d.high);
        const dates = data.map(d => d.date);
        const prices = data.map(d => d.close);
        
        const windowSize = 20;
        
        for (let i = windowSize; i < data.length - 5; i++) {
            const window = highs.slice(i - windowSize, i);
            const peaks = this.findPeaks(window);
            
            if (peaks.length >= 2) {
                const lastTwo = peaks.slice(-2);
                const peak1 = window[lastTwo[0]];
                const peak2 = window[lastTwo[1]];
                
                if (Math.abs(peak1 - peak2) / peak1 < 0.03) { // Peaks within 3%
                    const valleyIdx = lastTwo[0] + window.slice(lastTwo[0], lastTwo[1]).indexOf(Math.min(...window.slice(lastTwo[0], lastTwo[1])));
                    const valley = window[valleyIdx];
                    const currentPrice = prices[i];
                    const breakoutTarget = valley - (peak1 - valley);
                    
                    patterns.push({
                        type: 'double_top',
                        name: 'Double Top',
                        shape: 'double_peak',
                        startIndex: i - windowSize + lastTwo[0],
                        endIndex: i - windowSize + lastTwo[1],
                        startDate: dates[i - windowSize + lastTwo[0]],
                        endDate: dates[i - windowSize + lastTwo[1]],
                        peak1: peak1,
                        peak2: peak2,
                        valley: valley,
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: Math.max(peak1, peak2) * 1.02,
                        entryPoint: valley * 0.998,
                        exitPoint: breakoutTarget,
                        riskReward: (valley - breakoutTarget) / (Math.max(peak1, peak2) - valley),
                        confidence: 76,
                        direction: 'bearish',
                        description: `Double Top at $${peak1.toFixed(2)}. Support valley at $${valley.toFixed(2)}. ` +
                                   `Entry: Break below $${(valley * 0.998).toFixed(2)} | Target: $${breakoutTarget.toFixed(2)} | ` +
                                   `Stop: $${(Math.max(peak1, peak2) * 1.02).toFixed(2)}`,
                        coordinates: {
                            peaks: [
                                { x: dates[i - windowSize + lastTwo[0]], y: peak1 },
                                { x: dates[i - windowSize + lastTwo[1]], y: peak2 }
                            ],
                            valley: { x: dates[i - windowSize + valleyIdx], y: valley }
                        }
                    });
                }
            }
        }
        
        return patterns;
    },
    
    detectDoubleBottoms(data) {
        const patterns = [];
        const lows = data.map(d => d.low);
        const dates = data.map(d => d.date);
        const prices = data.map(d => d.close);
        
        const windowSize = 20;
        
        for (let i = windowSize; i < data.length - 5; i++) {
            const window = lows.slice(i - windowSize, i);
            const troughs = this.findTroughs(window);
            
            if (troughs.length >= 2) {
                const lastTwo = troughs.slice(-2);
                const trough1 = window[lastTwo[0]];
                const trough2 = window[lastTwo[1]];
                
                if (Math.abs(trough1 - trough2) / trough1 < 0.03) {
                    const peakIdx = lastTwo[0] + window.slice(lastTwo[0], lastTwo[1]).indexOf(Math.max(...window.slice(lastTwo[0], lastTwo[1])));
                    const peak = window[peakIdx];
                    const currentPrice = prices[i];
                    const breakoutTarget = peak + (peak - trough1);
                    
                    patterns.push({
                        type: 'double_bottom',
                        name: 'Double Bottom',
                        shape: 'double_trough',
                        startIndex: i - windowSize + lastTwo[0],
                        endIndex: i - windowSize + lastTwo[1],
                        startDate: dates[i - windowSize + lastTwo[0]],
                        endDate: dates[i - windowSize + lastTwo[1]],
                        trough1: trough1,
                        trough2: trough2,
                        peak: peak,
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: Math.min(trough1, trough2) * 0.98,
                        entryPoint: peak * 1.002,
                        exitPoint: breakoutTarget,
                        riskReward: (breakoutTarget - peak) / (peak - Math.min(trough1, trough2)),
                        confidence: 78,
                        direction: 'bullish',
                        description: `Double Bottom at $${trough1.toFixed(2)}. Resistance peak at $${peak.toFixed(2)}. ` +
                                   `Entry: Break above $${(peak * 1.002).toFixed(2)} | Target: $${breakoutTarget.toFixed(2)} | ` +
                                   `Stop: $${(Math.min(trough1, trough2) * 0.98).toFixed(2)}`,
                        coordinates: {
                            troughs: [
                                { x: dates[i - windowSize + lastTwo[0]], y: trough1 },
                                { x: dates[i - windowSize + lastTwo[1]], y: trough2 }
                            ],
                            peak: { x: dates[i - windowSize + peakIdx], y: peak }
                        }
                    });
                }
            }
        }
        
        return patterns;
    },
    
    /**
     * CUP AND HANDLE
     */
    detectCupAndHandle(data) {
        const patterns = [];
        const prices = data.map(d => d.close);
        const dates = data.map(d => d.date);
        
        const windowSize = 40;
        
        for (let i = windowSize; i < data.length - 10; i++) {
            const window = prices.slice(i - windowSize, i);
            
            // Find U-shape (cup)
            const firstThird = window.slice(0, Math.floor(windowSize / 3));
            const middleThird = window.slice(Math.floor(windowSize / 3), Math.floor(2 * windowSize / 3));
            const lastThird = window.slice(Math.floor(2 * windowSize / 3));
            
            const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
            const avgMiddle = middleThird.reduce((a, b) => a + b, 0) / middleThird.length;
            const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
            
            // Check for cup shape: high → low → high
            if (avgMiddle < avgFirst * 0.93 && avgLast > avgMiddle * 1.05 && Math.abs(avgFirst - avgLast) / avgFirst < 0.05) {
                const cupDepth = avgFirst - avgMiddle;
                const handleDepth = avgLast - Math.min(...lastThird.slice(-5));
                
                if (handleDepth < cupDepth * 0.5) { // Handle should be shallow
                    const currentPrice = prices[i];
                    const breakoutTarget = avgFirst + cupDepth;
                    const stopLoss = Math.min(...lastThird.slice(-5)) * 0.98;
                    
                    patterns.push({
                        type: 'cup_and_handle',
                        name: 'Cup and Handle',
                        shape: 'cup',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        cupRim: avgFirst,
                        cupBottom: avgMiddle,
                        handleBottom: Math.min(...lastThird.slice(-5)),
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: stopLoss,
                        entryPoint: avgFirst * 1.002,
                        exitPoint: breakoutTarget,
                        riskReward: (breakoutTarget - avgFirst) / (avgFirst - stopLoss),
                        confidence: 73,
                        direction: 'bullish',
                        description: `Cup and Handle pattern. Cup depth: ${(cupDepth / avgFirst * 100).toFixed(1)}%, Handle depth: ${(handleDepth / avgLast * 100).toFixed(1)}%. ` +
                                   `Entry: Break above $${(avgFirst * 1.002).toFixed(2)} | Target: $${breakoutTarget.toFixed(2)} | Stop: $${stopLoss.toFixed(2)}`,
                        coordinates: {
                            cupLeft: { x: dates[i - windowSize], y: avgFirst },
                            cupBottom: { x: dates[i - windowSize + Math.floor(windowSize / 2)], y: avgMiddle },
                            cupRight: { x: dates[i - Math.floor(windowSize / 3)], y: avgLast },
                            handleBottom: { x: dates[i - 5], y: Math.min(...lastThird.slice(-5)) }
                        }
                    });
                }
            }
        }
        
        return patterns;
    },
    
    /**
     * WEDGES
     */
    detectWedges(data) {
        const patterns = [];
        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);
        const dates = data.map(d => d.date);
        
        const windowSize = 20;
        
        for (let i = windowSize; i < data.length - 10; i++) {
            const highWindow = highs.slice(i - windowSize, i);
            const lowWindow = lows.slice(i - windowSize, i);
            
            const peaks = this.findPeaks(highWindow);
            const troughs = this.findTroughs(lowWindow);
            
            if (peaks.length >= 2 && troughs.length >= 2) {
                const peakPrices = peaks.map(p => highWindow[p]);
                const troughPrices = troughs.map(t => lowWindow[t]);
                
                const peakSlope = this.calculateSlope(peaks, peakPrices);
                const troughSlope = this.calculateSlope(troughs, troughPrices);
                
                // Rising wedge: both slopes positive, converging
                if (peakSlope > 0 && troughSlope > 0 && troughSlope > peakSlope * 1.5) {
                    const currentPrice = prices[i];
                    const wedgeHeight = Math.max(...peakPrices) - Math.min(...troughPrices);
                    const breakoutTarget = currentPrice - wedgeHeight * 0.618;
                    
                    patterns.push({
                        type: 'rising_wedge',
                        name: 'Rising Wedge',
                        shape: 'wedge',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: Math.max(...peakPrices.slice(-2)) * 1.02,
                        entryPoint: currentPrice * 0.995,
                        exitPoint: breakoutTarget,
                        riskReward: (currentPrice - breakoutTarget) / (Math.max(...peakPrices) - currentPrice),
                        confidence: 71,
                        direction: 'bearish',
                        description: `Rising Wedge (bearish). Converging upward slopes signal exhaustion. ` +
                                   `Entry: $${(currentPrice * 0.995).toFixed(2)} | Target: $${breakoutTarget.toFixed(2)} | Stop: $${(Math.max(...peakPrices.slice(-2)) * 1.02).toFixed(2)}`,
                        coordinates: {
                            topLine: peaks.slice(0, 2).map((p, idx) => ({
                                x: dates[i - windowSize + p],
                                y: peakPrices[idx]
                            })),
                            bottomLine: troughs.slice(0, 2).map((t, idx) => ({
                                x: dates[i - windowSize + t],
                                y: troughPrices[idx]
                            }))
                        }
                    });
                }
                
                // Falling wedge: both slopes negative, converging
                if (peakSlope < 0 && troughSlope < 0 && peakSlope < troughSlope * 1.5) {
                    const currentPrice = prices[i];
                    const wedgeHeight = Math.max(...peakPrices) - Math.min(...troughPrices);
                    const breakoutTarget = currentPrice + wedgeHeight * 0.618;
                    
                    patterns.push({
                        type: 'falling_wedge',
                        name: 'Falling Wedge',
                        shape: 'wedge',
                        startIndex: i - windowSize,
                        endIndex: i,
                        startDate: dates[i - windowSize],
                        endDate: dates[i],
                        currentPrice: currentPrice,
                        breakoutTarget: breakoutTarget,
                        stopLoss: Math.min(...troughPrices.slice(-2)) * 0.98,
                        entryPoint: currentPrice * 1.005,
                        exitPoint: breakoutTarget,
                        riskReward: (breakoutTarget - currentPrice) / (currentPrice - Math.min(...troughPrices)),
                        confidence: 74,
                        direction: 'bullish',
                        description: `Falling Wedge (bullish). Converging downward slopes signal reversal. ` +
                                   `Entry: $${(currentPrice * 1.005).toFixed(2)} | Target: $${breakoutTarget.toFixed(2)} | Stop: $${(Math.min(...troughPrices.slice(-2)) * 0.98).toFixed(2)}`,
                        coordinates: {
                            topLine: peaks.slice(0, 2).map((p, idx) => ({
                                x: dates[i - windowSize + p],
                                y: peakPrices[idx]
                            })),
                            bottomLine: troughs.slice(0, 2).map((t, idx) => ({
                                x: dates[i - windowSize + t],
                                y: troughPrices[idx]
                            }))
                        }
                    });
                }
            }
        }
        
        return patterns;
    },
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    findPeaks(data) {
        const peaks = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] > data[i-1] && data[i] > data[i-2] &&
                data[i] > data[i+1] && data[i] > data[i+2]) {
                peaks.push(i);
            }
        }
        return peaks;
    },
    
    findTroughs(data) {
        const troughs = [];
        for (let i = 2; i < data.length - 2; i++) {
            if (data[i] < data[i-1] && data[i] < data[i-2] &&
                data[i] < data[i+1] && data[i] < data[i+2]) {
                troughs.push(i);
            }
        }
        return troughs;
    },
    
    calculateSlope(indices, values) {
        if (indices.length < 2) return 0;
        
        const n = indices.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += indices[i];
            sumY += values[i];
            sumXY += indices[i] * values[i];
            sumX2 += indices[i] * indices[i];
        }
        
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    },
    
    calculateApex(peaks, peakValues, troughs, troughValues) {
        const peakSlope = this.calculateSlope(peaks, peakValues);
        const troughSlope = this.calculateSlope(troughs, troughValues);
        
        // Find intersection point
        const avgPeak = peakValues.reduce((a, b) => a + b, 0) / peakValues.length;
        const avgTrough = troughValues.reduce((a, b) => a + b, 0) / troughValues.length;
        
        return (avgPeak + avgTrough) / 2;
    },
    
    calculateVolatility(prices) {
        const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
};

// Export
if (typeof window !== 'undefined') {
    window.PatternDetection = PatternDetection;
}
