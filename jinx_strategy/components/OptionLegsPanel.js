// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { OptionLeg, OptionType, Action, OptionsChainData, ModalPrimingLegInfo } from '../types.js';
import { MAX_LEGS, PlusIcon, TrashIcon, WalletIcon } from '../constants.js'; // Assuming .js
import { InputField, SelectField } from './SharedControls.js'; // Assuming .js
import { OptionType, Action } from '../types.js'; // Import runtime values

/**
 * @typedef {import('../types.js').OptionLeg} OptionLeg
 * @typedef {import('../types.js').OptionsChainData} OptionsChainData
 */

/**
 * @typedef {Object} OptionLegsPanelProps
 * @property {OptionLeg[]} legs
 * @property {(id: string, field: keyof OptionLeg, value: string | typeof OptionType[keyof typeof OptionType] | typeof Action[keyof typeof Action]) => void} onLegChange
 * @property {() => void} onAddLeg
 * @property {(id: string) => void} onRemoveLeg
 * @property {(legId: string, currentStrike: string, optionType: typeof OptionType[keyof typeof OptionType]) => void} onOpenChainForLeg
 * @property {OptionsChainData | null} optionsChainForModal
 * @property {boolean} anyAppLoading
 */

/**
 * @param {OptionLegsPanelProps} props
 * @returns {React.ReactElement}
 */
const OptionLegsPanel = ({
    legs, onLegChange, onAddLeg, onRemoveLeg, onOpenChainForLeg, optionsChainForModal, anyAppLoading
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. OptionLegsPanel component cannot render.");
        return null;
    }

    const optionTypeOptions = [{ value: OptionType.Call, label: 'Call' }, { value: OptionType.Put, label: 'Put' }];
    const actionOptions = [{ value: Action.Buy, label: 'Buy' }, { value: Action.Sell, label: 'Sell' }];

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            'div',
            { className: "flex justify-between items-center mb-4 border-b pb-2 border-[#D1D5DB]" },
            React.createElement('h3', { className: "text-xl font-semibold text-[#00407A]" }, "Define Legs"),
            React.createElement(
                'button',
                { onClick: onAddLeg, disabled: legs.length >= MAX_LEGS || anyAppLoading, className: "flex items-center bg-[#00539B] hover:bg-[#00407A] text-white text-sm font-medium py-2 px-3 rounded-md shadow-sm disabled:opacity-50 transition-all" },
                React.createElement(PlusIcon, null), " Add Leg"
            )
        ),
        React.createElement(
            'div',
            { className: "space-y-4 max-h-96 overflow-y-auto pr-2" },
            legs.map((leg, index) => React.createElement(
                'div',
                { key: leg.id, className: "p-3 border border-[#E5E7EB] rounded-lg bg-slate-50/70 shadow-sm" },
                React.createElement(
                    'div',
                    { className: "flex justify-between items-center mb-2" },
                    React.createElement('h3', { className: "text-sm font-semibold text-[#00539B]" }, `Leg ${index + 1} `, React.createElement('span', {className: "text-xs text-gray-500 font-normal"}, `(${leg.role || 'N/A'})`)),
                    React.createElement(
                        'button',
                        { onClick: () => onRemoveLeg(leg.id), disabled: anyAppLoading, className: "text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors p-1 rounded-full hover:bg-red-100" },
                        React.createElement(TrashIcon, null)
                    )
                ),
                React.createElement(
                    'div',
                    { className: "grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1" },
                    React.createElement(SelectField, { label: "Type", id: `type-${leg.id}`, value: leg.type, onChange: e => onLegChange(leg.id, 'type', e.target.value), options: optionTypeOptions, disabled: anyAppLoading }),
                    React.createElement(SelectField, { label: "Action", id: `action-${leg.id}`, value: leg.action, onChange: e => onLegChange(leg.id, 'action', e.target.value), options: actionOptions, disabled: anyAppLoading }),
                    React.createElement(InputField, { label: "Strike", id: `strike-${leg.id}`, type: "number", value: leg.strike, onChange: e => onLegChange(leg.id, 'strike', e.target.value), placeholder: "e.g., 100", step: "0.01", disabled: anyAppLoading, required: true }),
                    React.createElement(InputField, { label: "Premium", id: `premium-${leg.id}`, type: "number", value: leg.premium, onChange: e => onLegChange(leg.id, 'premium', e.target.value), placeholder: "e.g., 1.50", step: "0.01", disabled: anyAppLoading, required: true }),
                    React.createElement(InputField, { label: "Qty", id: `quantity-${leg.id}`, type: "number", value: leg.quantity, onChange: e => onLegChange(leg.id, 'quantity', e.target.value), placeholder: "e.g., 1", min: "1", disabled: anyAppLoading, required: true }),
                    optionsChainForModal && leg.strike && React.createElement(
                        'button',
                        {
                            onClick: () => onOpenChainForLeg(leg.id, leg.strike, leg.type),
                            disabled: anyAppLoading,
                            title: `Set Premium for K:${leg.strike} ${leg.type} from Chain`,
                            className: "mt-4 col-span-2 sm:col-span-1 flex items-center justify-center text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-medium py-1.5 px-2 rounded-md border border-sky-300 shadow-sm disabled:opacity-50 transition-all"
                        },
                        React.createElement(WalletIcon, { className: "mr-1" }), " Set from Chain"
                    )
                ),
                leg.premiumMissing && leg.strike && React.createElement('p', { className: "text-xs text-orange-600 mt-1 italic" }, `Premium needed for K:${leg.strike} ${leg.type}.`)
            ))
        )
    );
};

export default OptionLegsPanel;
