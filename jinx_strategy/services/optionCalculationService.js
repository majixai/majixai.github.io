import { OptionType, Action } from '../types.js'; // Assuming .js extension
import { calculateBlackScholes } from './blackScholesService.js'; // Assuming .js extension

/**
 * @typedef {Object} ValidatedLeg
 * @property {OptionType} type
 * @property {Action} action
 * @property {number} strike
 * @property {number} premium // This will be the original premium or simulated premium
 * @property {number} quantity
 * @property {number} [originalPremium] // Store original premium if simulating
 * @property {string} [role]
 */

/**
 * @typedef {Object} SimulationParams
 * @property {number} tte // in years
 * @property {number} sigma // decimal
 * @property {number} r // decimal
 * @property {number} currentS
 */

/**
 * @param {number} sT
 * @param {ValidatedLeg} leg
 * @param {number} pointValue
 * @returns {number}
 */
function calculateSingleLegPayoff(
  sT,
  leg,
  pointValue
) {
  let intrinsicValue = 0;
  if (leg.type === OptionType.Call) {
    intrinsicValue = Math.max(0, sT - leg.strike);
  } else if (leg.type === OptionType.Put) {
    intrinsicValue = Math.max(0, leg.strike - sT);
  }

  let pnlPerUnit;
  if (leg.action === Action.Buy) {
    pnlPerUnit = intrinsicValue - leg.premium;
  } else { // Sell
    pnlPerUnit = -intrinsicValue + leg.premium;
  }
  return pnlPerUnit * leg.quantity * pointValue;
}

/**
 * @param {import('../types.js').OptionLeg[]} legsInput
 * @param {import('../types.js').PlotOptions} plotOptions
 * @param {SimulationParams} [simulationParams]
 * @returns {import('../types.js').ChartData | { error: string }}
 */
export function generatePlotData(
  legsInput,
  plotOptions,
  simulationParams
) {
  try {
    if (!legsInput || legsInput.length === 0) {
      return { error: "Please add at least one option leg." };
    }

    /** @type {ValidatedLeg[]} */
    const validatedLegs = [];
    /** @type {number[]} */
    const allStrikes = [];

    for (let i = 0; i < legsInput.length; i++) {
      const leg = legsInput[i];
      const strike = parseFloat(leg.strike);
      const premium = parseFloat(leg.premium);
      const quantity = parseInt(leg.quantity, 10);

      if (isNaN(strike) || strike <= 0) return { error: `Leg ${i + 1}: Strike must be a positive number.` };
      if (isNaN(premium) || premium < 0) return { error: `Leg ${i + 1}: Premium must be non-negative.` };
      if (isNaN(quantity) || quantity <= 0) return { error: `Leg ${i + 1}: Quantity must be a positive integer.` };

      validatedLegs.push({ type: leg.type, action: leg.action, strike, premium, quantity, originalPremium: premium, role: leg.role });
      allStrikes.push(strike);
    }

    if (simulationParams) {
        if (isNaN(simulationParams.currentS) || simulationParams.currentS <= 0) {
            return { error: "Current Stock Price for TTE simulation must be a positive number."};
        }
        for (let i = 0; i < validatedLegs.length; i++) {
            const leg = validatedLegs[i];
            /** @type {import('../types.js').BlackScholesInputs} */
            const bsInputs = {
                stockPrice: simulationParams.currentS.toString(),
                strikePrice: leg.strike.toString(),
                timeToExpiration: simulationParams.tte.toString(),
                riskFreeRate: simulationParams.r.toString(),
                volatility: simulationParams.sigma.toString(),
                optionType: leg.type,
            };
            const bsResult = calculateBlackScholes(bsInputs);
            if ('error' in bsResult) {
                console.warn(`TTE Sim: BS calculation error for Leg ${i+1} (${leg.role || leg.type + leg.strike.toString()}): ${bsResult.error}. Using original premium.`);
            } else {
                const calculatedPrice = leg.type === OptionType.Call ? bsResult.callPrice : bsResult.putPrice;
                if (calculatedPrice !== undefined && calculatedPrice >= 0) {
                    validatedLegs[i].premium = parseFloat(calculatedPrice.toFixed(4));
                } else {
                    console.warn(`TTE Sim: BS calculated undefined/negative premium for Leg ${i+1}. Using original premium.`);
                }
            }
        }
    }

    const pointValue = parseFloat(plotOptions.pointValue);
    if (isNaN(pointValue) || pointValue <= 0) return { error: "Point Value must be a positive number." };

    let numPoints = parseInt(plotOptions.numPoints, 10);
    if (isNaN(numPoints) || numPoints < 10 || numPoints > 1000) numPoints = 200;

    const currentSNum = plotOptions.currentS ? parseFloat(plotOptions.currentS) : undefined;
    if (plotOptions.currentS && (currentSNum === undefined || isNaN(currentSNum) || currentSNum < 0)) {
        return { error: "Current S Price must be a non-negative number if provided." };
    }

    let minST = plotOptions.minST ? parseFloat(plotOptions.minST) : null;
    let maxST = plotOptions.maxST ? parseFloat(plotOptions.maxST) : null;

    if (minST === null || maxST === null || isNaN(minST) || isNaN(maxST) || minST >= maxST) {
      const sortedStrikes = [...allStrikes].sort((a, b) => a - b);
      let rangeCenter, rangeSpan;

      if (sortedStrikes.length > 0) {
        const firstStrike = sortedStrikes[0];
        const lastStrike = sortedStrikes[sortedStrikes.length - 1];
        rangeCenter = (firstStrike + lastStrike) / 2;
        rangeSpan = Math.max(lastStrike - firstStrike, firstStrike * 0.3);
        if (rangeSpan === 0) rangeSpan = firstStrike * 0.4;
      } else if (currentSNum !== undefined && !isNaN(currentSNum)) {
        rangeCenter = currentSNum;
        rangeSpan = currentSNum * 0.4;
      } else {
        rangeCenter = 100;
        rangeSpan = 40;
      }

      minST = rangeCenter - rangeSpan * 0.75;
      maxST = rangeCenter + rangeSpan * 0.75;

      if (currentSNum !== undefined && !isNaN(currentSNum)) {
        minST = Math.min(minST, currentSNum * 0.7);
        maxST = Math.max(maxST, currentSNum * 1.3);
      }
      minST = Math.max(0, minST);
      if (minST >= maxST) maxST = minST + 20;
    }

    /** @type {number[]} */
    const sTArray = [];
    const step = (maxST - minST) / (numPoints - 1);
    for (let i = 0; i < numPoints; i++) {
      sTArray.push(minST + i * step);
    }

    const totalPayoff = new Array(numPoints).fill(0);
    /** @type {number[][]} */
    const individualLegPayoffs = [];
    /** @type {string[]} */
    const legDescriptions = [];
    /** @type {string[]} */
    let strategyNameParts = [];

    validatedLegs.forEach((leg, index) => {
      const legPayoffValues = sTArray.map(sT => calculateSingleLegPayoff(sT, leg, pointValue));
      individualLegPayoffs.push(legPayoffValues);

      const desc = `${leg.action.charAt(0).toUpperCase() + leg.action.slice(1)} ${leg.quantity} ${leg.type.charAt(0).toUpperCase() + leg.type.slice(1)} @${leg.strike.toFixed(2)} (Prem: ${leg.premium.toFixed(2)})${simulationParams ? ' (Sim)' : ''}`;
      legDescriptions.push(`Leg ${index + 1}: ${desc}`);

      for (let i = 0; i < numPoints; i++) {
        totalPayoff[i] += legPayoffValues[i];
      }
      strategyNameParts.push(`${leg.action[0].toUpperCase()}${leg.quantity}${leg.type[0].toUpperCase()}${leg.strike}`);
    });

    const maxProfit = Math.max(...totalPayoff);
    const maxLoss = Math.min(...totalPayoff);

    let riskRewardRatio = "N/A";
    if (maxLoss < 0 && maxProfit > 0) {
      riskRewardRatio = parseFloat((maxProfit / Math.abs(maxLoss)).toFixed(2));
    } else if (maxLoss === 0 && maxProfit > 0) {
      riskRewardRatio = "Infinite";
    } else if (maxProfit <= 0) {
        riskRewardRatio = "N/A (No Profit in Range)";
    }

    let profitablePoints = 0;
    for (const pnl of totalPayoff) {
      if (pnl > 0) {
        profitablePoints++;
      }
    }
    const profitZoneInPlot = parseFloat(((profitablePoints / numPoints) * 100).toFixed(1));

    const simSuffix = simulationParams ? ` (Sim TTE: ${(simulationParams.tte * 365).toFixed(0)}d)` : '';

    return {
      sTArray,
      totalPayoff,
      individualLegPayoffs,
      legDescriptions,
      minSTPlot: minST,
      maxSTPlot: maxST,
      currentSNum: currentSNum,
      underlyingName: plotOptions.underlyingName || "Underlying",
      strategyTitleShort: (strategyNameParts.join(" / ") || "Custom Strategy") + simSuffix,
      maxProfit,
      maxLoss,
      riskRewardRatio,
      profitZoneInPlot,
    };

  } catch (error) {
    console.error("Error generating plot data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during plot data generation.";
    return { error: `Server error: ${errorMessage}` };
  }
}
