// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { OptionsChainData, OptionChainEntry, OptionType, Action, OptionLeg, TargetStrikeInfo, ModalPrimingLegInfo } from '../types.js';
import { OptionType, Action } from '../types.js'; // Import runtime values

/**
 * @typedef {import('../types.js').OptionsChainData} OptionsChainData
 * @typedef {import('../types.js').OptionChainEntry} OptionChainEntry
 * @typedef {import('../types.js').OptionLeg} OptionLeg
 * @typedef {import('../types.js').TargetStrikeInfo} TargetStrikeInfo
 * @typedef {import('../types.js').ModalPrimingLegInfo} ModalPrimingLegInfo
 */

/**
 * @typedef {Object} OptionsChainModalProps
 * @property {boolean} isOpen
 * @property {() => void} onClose
 * @property {OptionsChainData | null} optionsChain
 * @property {OptionLeg[]} currentUILegs
 * @property {TargetStrikeInfo[] | null} targetStrikesFromAI
 * @property {(legIdToUpdate: string, premium: number, strikePrice: number, optionType: typeof OptionType[keyof typeof OptionType]) => void} onPremiumSelect
 * @property {string} underlyingName
 * @property {number | null} [currentStockPriceForChain]
 * @property {ModalPrimingLegInfo | null} [primedLegForModal]
 */

/**
 * @param {OptionsChainModalProps} props
 * @returns {React.ReactElement | null}
 */
const OptionsChainModal = ({
  isOpen,
  onClose,
  optionsChain,
  currentUILegs,
  targetStrikesFromAI,
  onPremiumSelect,
  underlyingName,
  currentStockPriceForChain,
  primedLegForModal,
}) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. OptionsChainModal component cannot render.");
    return null;
  }
  if (!isOpen || !optionsChain) return null;

  const formatPrice = (price, defaultVal = 'N/A') => {
    if (price === null || price === undefined) return defaultVal;
    return price.toFixed(2);
  };

  const formatNumber = (num, defaultVal = 'N/A') => {
    if (num === null || num === undefined) return defaultVal;
    return num.toLocaleString();
  };

  const getHighlightClass = (strike, optionType) => {
    const isTargetAIStrike = targetStrikesFromAI?.some(ts => ts.targetStrike === strike);
    const isCurrentUILegStrike = currentUILegs.some(leg => parseFloat(leg.strike) === strike && leg.type === optionType);
    const isPrimedStrike = primedLegForModal?.strike === strike.toString() && primedLegForModal?.optionType === optionType;

    if (isPrimedStrike) return 'bg-yellow-100 border-l-4 border-yellow-500';
    if (isTargetAIStrike && isCurrentUILegStrike) return 'bg-teal-100 border-l-4 border-teal-500';
    if (isTargetAIStrike) return 'bg-blue-100 border-l-4 border-blue-500';
    if (isCurrentUILegStrike) return 'bg-green-100 border-l-4 border-green-500';
    return '';
  };

  const getPriceCellClass = (strike, optionType, action) => {
    const relevantUILeg = currentUILegs.find(leg =>
        parseFloat(leg.strike) === strike &&
        leg.type === optionType &&
        leg.action === action
    );
    const isPrimedForThisAction = primedLegForModal?.strike === strike.toString() &&
                                 primedLegForModal?.optionType === optionType &&
                                 (currentUILegs.find(l => l.id === primedLegForModal.legId)?.action === action);

    if (relevantUILeg || isPrimedForThisAction) return 'font-bold text-[#00539B]';
    return '';
  };

  const handlePriceClick = (strike, optionType, price, priceType) => {
    if (price === null || price === undefined) return;
    let legToUpdateId;

    if (primedLegForModal && primedLegForModal.strike === strike.toString() && primedLegForModal.optionType === optionType) {
        const primedLeg = currentUILegs.find(l => l.id === primedLegForModal.legId);
        if (primedLeg) {
            const impliedAction = (priceType === 'ask') ? Action.Buy : Action.Sell;
            if (priceType === 'mid' || primedLeg.action === impliedAction) {
                 legToUpdateId = primedLegForModal.legId;
            }
        }
    }

    if (!legToUpdateId) {
        const impliedAction = (priceType === 'ask') ? Action.Buy : (priceType === 'bid') ? Action.Sell :
                              (currentUILegs.find(leg => parseFloat(leg.strike) === strike && leg.type === optionType)?.action || Action.Buy);
        const legToUpdate = currentUILegs.find(leg =>
            parseFloat(leg.strike) === strike &&
            leg.type === optionType &&
            leg.action === impliedAction
        );
        if (legToUpdate) {
            legToUpdateId = legToUpdate.id;
        } else {
            const anyMatchingLeg = currentUILegs.find(leg => parseFloat(leg.strike) === strike && leg.type === optionType);
            if (anyMatchingLeg) legToUpdateId = anyMatchingLeg.id;
        }
    }

    if (legToUpdateId) {
      onPremiumSelect(legToUpdateId, price, strike, optionType);
    } else {
      console.warn("No suitable leg found in UI to update for strike:", strike, "type:", optionType, "priceType:", priceType);
    }
  };

  const renderChainTable = (data, optionType, title) => React.createElement(
    'div', { className: "w-full lg:w-1/2 px-2 mb-6", key: title },
    React.createElement('h3', { className: "text-lg font-semibold text-[#00407A] mb-2 text-center" }, title),
    React.createElement(
      'div', { className: "overflow-x-auto max-h-[60vh] border border-[#D1D5DB] rounded-md shadow-sm" },
      React.createElement(
        'table', { className: "min-w-full divide-y divide-[#E5E7EB] text-xs" },
        React.createElement(
          'thead', { className: "bg-[#E6F0F8] sticky top-0 z-10" },
          React.createElement(
            'tr', null,
            ['Strike', 'Bid', 'Ask', 'Mid', 'Last', 'Parity', 'Vol', 'OI', 'Vol/OI'].map(header => React.createElement(
              'th', { key: header, className: "px-3 py-2 text-left font-medium text-[#00539B] tracking-wider" }, header
            ))
          )
        ),
        React.createElement(
          'tbody', { className: "bg-white divide-y divide-[#E5E7EB]" },
          (data && data.length > 0) ? data.map((opt, index) => {
            const volOiRatio = (opt.volume && opt.openInterest && opt.openInterest > 0) ? (opt.volume / opt.openInterest).toFixed(2) : 'N/A';
            const highlightClass = getHighlightClass(opt.strike, optionType);
            return React.createElement(
              'tr', { key: `${optionType}-${opt.strike}-${index}`, className: `${highlightClass} hover:bg-slate-50 transition-colors` },
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap font-medium text-[#333333]" }, formatPrice(opt.strike)),
              React.createElement('td', { className: `px-3 py-2 whitespace-nowrap ${getPriceCellClass(opt.strike, optionType, Action.Sell)}` },
                React.createElement('button', { onClick: () => handlePriceClick(opt.strike, optionType, opt.bid, 'bid'), className: "hover:underline disabled:opacity-50 disabled:no-underline", disabled: opt.bid === null }, formatPrice(opt.bid))
              ),
              React.createElement('td', { className: `px-3 py-2 whitespace-nowrap ${getPriceCellClass(opt.strike, optionType, Action.Buy)}` },
                React.createElement('button', { onClick: () => handlePriceClick(opt.strike, optionType, opt.ask, 'ask'), className: "hover:underline disabled:opacity-50 disabled:no-underline", disabled: opt.ask === null }, formatPrice(opt.ask))
              ),
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap" },
                 React.createElement('button', { onClick: () => handlePriceClick(opt.strike, optionType, opt.mid, 'mid'), className: "hover:underline disabled:opacity-50 disabled:no-underline", disabled: opt.mid === null }, formatPrice(opt.mid))
              ),
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap" }, formatPrice(opt.last)),
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap" }, formatPrice(opt.parity)),
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap" }, formatNumber(opt.volume)),
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap" }, formatNumber(opt.openInterest)),
              React.createElement('td', { className: "px-3 py-2 whitespace-nowrap" }, volOiRatio)
            );
          }) : React.createElement('tr', null, React.createElement('td', { colSpan: 9, className: "text-center py-4 text-gray-500" }, `No ${optionType} data available.`))
        )
      )
    )
  );

  return React.createElement(
    'div', { className: "fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300" },
    React.createElement(
      'div', { className: "bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col p-6 transform transition-all duration-300 scale-100 opacity-100" },
      React.createElement(
        'div', { className: "flex justify-between items-center mb-4 border-b border-[#D1D5DB] pb-3" },
        React.createElement(
          'div', null,
          React.createElement('h2', { className: "text-xl font-semibold text-[#00407A]" }, `Options Chain for ${underlyingName.toUpperCase()}`),
          React.createElement('p', { className: "text-xs text-gray-500" }, `Expiration: ${optionsChain.expirationDate || 'N/A'} | Stock Price (at fetch): ${formatPrice(currentStockPriceForChain, 'N/A')}`),
          React.createElement(
            'p', {className: "text-xs text-gray-500 mt-1"},
            React.createElement('span', {className: "inline-block w-3 h-3 bg-yellow-100 border border-yellow-500 mr-1"}), " Primed Leg",
            React.createElement('span', {className: "inline-block w-3 h-3 bg-blue-100 border border-blue-500 ml-2 mr-1"}), " AI Target",
            React.createElement('span', {className: "inline-block w-3 h-3 bg-green-100 border border-green-500 ml-2 mr-1"}), " UI Leg",
            React.createElement('span', {className: "inline-block w-3 h-3 bg-teal-100 border border-teal-500 ml-2 mr-1"}), " AI & UI"
          )
        ),
        React.createElement(
          'button', { onClick: onClose, className: "text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full", 'aria-label': "Close options chain modal" },
          React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-7 w-7", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" })
          )
        )
      ),
      React.createElement(
        'div', { className: "flex flex-col lg:flex-row flex-grow overflow-y-auto" },
        renderChainTable(optionsChain.calls || [], OptionType.Call, 'Calls'),
        renderChainTable(optionsChain.puts || [], OptionType.Put, 'Puts')
      ),
      React.createElement(
        'div', { className: "mt-6 pt-4 border-t border-[#D1D5DB] flex justify-end" },
        React.createElement('button', { onClick: onClose, className: "bg-[#00539B] hover:bg-[#00407A] text-white font-semibold py-2 px-6 rounded-md shadow-sm transition-colors" }, "Apply Selections & Close")
      )
    )
  );
};

export default OptionsChainModal;
