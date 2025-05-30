// Assuming React is available globally e.g. via CDN
import { TEXT_COLOR_SECONDARY, BORDER_COLOR, DUKE_BLUE, PANEL_BACKGROUND, TEXT_COLOR_PRIMARY } from '../constants.js';

/**
 * @typedef {Object} InputFieldProps
 * @property {string} label
 * @property {string} id
 * @property {string} [type="text"]
 * @property {string} value
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChange
 * @property {string} [placeholder]
 * @property {string} [step]
 * @property {string} [min]
 * @property {string} [max]
 * @property {string} [className=""]
 * @property {boolean} [disabled=false]
 * @property {boolean} [required=false]
 * @property {string} [list]
 */

/**
 * @param {InputFieldProps} props
 * @returns {React.ReactElement}
 */
export const InputField = ({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  className = "",
  disabled = false,
  required = false,
  list
}) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. InputField component cannot render.");
    return null; 
  }
  return React.createElement(
    'div',
    { className: `mb-3 ${className}` },
    React.createElement(
      'label',
      { htmlFor: id, className: "block text-xs font-medium mb-1", style: { color: TEXT_COLOR_SECONDARY } },
      label,
      required && React.createElement('span', { className: "text-red-500" }, "*")
    ),
    React.createElement(
      'input',
      {
        type: type,
        id: id,
        name: id,
        value: value,
        onChange: onChange,
        placeholder: placeholder,
        step: step,
        min: min,
        max: max,
        disabled: disabled,
        required: required,
        list: list,
        className: "w-full p-2.5 border rounded-md shadow-sm text-sm focus:ring-2 focus:ring-opacity-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
        style: {
          borderColor: BORDER_COLOR,
          color: disabled ? TEXT_COLOR_SECONDARY : TEXT_COLOR_PRIMARY,
          backgroundColor: disabled ? '#F1F5F9' : PANEL_BACKGROUND,
          outlineColor: DUKE_BLUE,
        },
        autoComplete: list ? "off" : "on"
      }
    )
  );
};

/**
 * @typedef {Object} SelectFieldProps
 * @property {string} label
 * @property {string} id
 * @property {string} value
 * @property {(e: React.ChangeEvent<HTMLSelectElement>) => void} onChange
 * @property {{ value: string; label: string }[]} options
 * @property {string} [className=""]
 * @property {boolean} [disabled=false]
 */

/**
 * @param {SelectFieldProps} props
 * @returns {React.ReactElement}
 */
export const SelectField = ({
  label,
  id,
  value,
  onChange,
  options,
  className = "",
  disabled = false
}) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. SelectField component cannot render.");
    return null;
  }
  return React.createElement(
    'div',
    { className: `mb-3 ${className}` },
    React.createElement(
      'label',
      { htmlFor: id, className: "block text-xs font-medium mb-1", style: { color: TEXT_COLOR_SECONDARY } },
      label
    ),
    React.createElement(
      'select',
      {
        id: id,
        name: id,
        value: value,
        onChange: onChange,
        disabled: disabled,
        className: "w-full p-2.5 border rounded-md shadow-sm text-sm focus:ring-2 focus:ring-opacity-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
        style: {
          borderColor: BORDER_COLOR,
          color: disabled ? TEXT_COLOR_SECONDARY : TEXT_COLOR_PRIMARY,
          backgroundColor: disabled ? '#F1F5F9' : PANEL_BACKGROUND,
          outlineColor: DUKE_BLUE,
        }
      },
      options.map(opt => React.createElement('option', { key: opt.value, value: opt.value }, opt.label))
    )
  );
};
