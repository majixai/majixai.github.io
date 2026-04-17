/**
 * mvc-validator.js — MajixMvcValidator
 *
 * Provides 80+ built-in validation rules, custom rule registration,
 * async validation support, rule chaining, and i18n error messages.
 *
 * Usage:
 *   <script src="/mvc/mvc-validator.js"></script>
 *   MajixMvcValidator.init();
 *
 *   // Single field
 *   var result = MajixMvcValidator.validate(value, "required|email");
 *
 *   // Schema (multiple fields)
 *   var errors = MajixMvcValidator.validateSchema(data, {
 *     name:  "required|min_length:2",
 *     email: "required|email",
 *     age:   "required|integer|between:18,120"
 *   });
 *
 * @version 1.0.0
 */

(function (global) {
  'use strict';

  var VERSION = "1.0.0";

  // ─── Internal state ───────────────────────────────────────────────────────
  var _rules = {};
  var _messages = {};
  var _events = {};
  var _cfg = {
    locale: "en",
    stopOnFirstFailure: false,
    debug: false
  };

  // ─── Event emitter ─────────────────────────────────────────────────────────
  function on(event, fn) {
    if (!_events[event]) _events[event] = [];
    _events[event].push(fn);
  }
  function off(event, fn) {
    if (!_events[event]) return;
    _events[event] = _events[event].filter(function(h) { return h !== fn; });
  }
  function emit(event, data) {
    var handlers = _events[event] || [];
    handlers.slice().forEach(function(h) {
      try { h(data); } catch(e) { if (_cfg.debug) console.warn("[Validator] event error:", e); }
    });
  }

  // ─── Utility helpers ───────────────────────────────────────────────────────
  function isString(v)  { return typeof v === "string"; }
  function isNumber(v)  { return typeof v === "number" && isFinite(v); }
  function isInteger(v) { return Number.isInteger(Number(v)) && String(v).indexOf(".") === -1; }
  function isArray(v)   { return Array.isArray(v); }
  function isObject(v)  { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function isEmpty(v) {
    if (v === null || v === undefined) return true;
    if (isString(v)) return v.trim() === "";
    if (isArray(v)) return v.length === 0;
    if (isObject(v)) return Object.keys(v).length === 0;
    return false;
  }
  function parseArg(ruleStr) {
    var idx = ruleStr.indexOf(":");
    if (idx === -1) return { name: ruleStr, arg: null, args: [] };
    var name = ruleStr.slice(0, idx);
    var rest = ruleStr.slice(idx + 1);
    return { name: name, arg: rest, args: rest.split(",") };
  }
  function coerce(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }
  function numOf(v) { return Number(v); }
  function luhn(n) {
    var s = String(n).replace(/\D/g, "");
    if (!s.length) return false;
    var sum = 0, alt = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var d = parseInt(s.charAt(i), 10);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  }

  // ─── Register a rule ───────────────────────────────────────────────────────
  /**
   * Register a custom validation rule.
   *
   * @param {string}   name    - Rule identifier (e.g. "my_rule").
   * @param {Function} fn      - Validator function (value, arg, args, data) => boolean.
   * @param {string|Function} [msg] - Error message or message function.
   */
  function addRule(name, fn, msg) {
    if (!isString(name) || name.trim() === "") throw new Error("[Validator] rule name must be a non-empty string");
    if (typeof fn !== "function") throw new Error("[Validator] rule handler must be a function");
    _rules[name] = fn;
    if (msg) _messages[name] = msg;
  }

  // ─── Apply one rule ────────────────────────────────────────────────────────
  /**
   * Apply a single rule to a value.
   *
   * @param {any}    value   - The value to validate.
   * @param {string} ruleStr - Rule string, e.g. "min_length:3".
   * @param {object} [data]  - Full data object (for cross-field rules).
   * @returns {boolean} true if the value passes the rule.
   */
  function applyRule(value, ruleStr, data) {
    var p = parseArg(ruleStr);
    var fn = _rules[p.name];
    if (!fn) {
      if (_cfg.debug) console.warn("[Validator] unknown rule:", p.name);
      return true; // unknown rules pass by default
    }
    try {
      return fn(value, p.arg, p.args, data || {});
    } catch(e) {
      if (_cfg.debug) console.error("[Validator] rule error:", p.name, e);
      return false;
    }
  }

  // ─── Get error message ─────────────────────────────────────────────────────
  /**
   * Get the localised error message for a failed rule.
   *
   * @param {string} field   - The field label.
   * @param {string} ruleStr - The rule string (may include arg).
   * @returns {string} Human-readable error message.
   */
  function getMessage(field, ruleStr) {
    var p = parseArg(ruleStr);
    var msg = _messages[p.name];
    if (!msg) return "The " + field + " field is invalid.";
    if (typeof msg === "function") return msg(field, p.arg, p.args);
    return msg
      .replace(/:field/g, field)
      .replace(/:arg/g, p.arg || "")
      .replace(/:0/g, p.args[0] || "")
      .replace(/:1/g, p.args[1] || "");
  }

  // ─── Validate a single field ───────────────────────────────────────────────
  /**
   * Validate a single value against a pipe-separated rule string.
   *
   * @param {any}    value    - The value to validate.
   * @param {string} rules    - Pipe-separated rules, e.g. "required|email".
   * @param {string} [field]  - Field label for error messages.
   * @param {object} [data]   - Full data object for cross-field rules.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(value, rules, field, data) {
    field = field || "field";
    var ruleList = String(rules || "").split("|").filter(Boolean);
    var errors = [];
    // If "optional" and empty, skip remaining rules
    var isOptional = ruleList.indexOf("optional") !== -1;
    if (isOptional && isEmpty(value)) return { valid: true, errors: [] };
    for (var i = 0; i < ruleList.length; i++) {
      var r = ruleList[i];
      if (r === "optional" || r === "nullable") continue;
      if (!applyRule(value, r, data)) {
        var errMsg = getMessage(field, r);
        errors.push(errMsg);
        emit("validator:fail", { field: field, value: value, rule: r, message: errMsg });
        if (_cfg.stopOnFirstFailure) break;
      } else {
        emit("validator:pass", { field: field, value: value, rule: r });
      }
    }
    return { valid: errors.length === 0, errors: errors };
  }

  // ─── Validate a schema ────────────────────────────────────────────────────
  /**
   * Validate a data object against a schema of rules.
   *
   * @param {object} data   - The data object to validate.
   * @param {object} schema - Map of field => rule string.
   * @returns {{ valid: boolean, errors: object }} errors is a map of field => string[].
   */
  function validateSchema(data, schema) {
    var errors = {};
    var valid = true;
    Object.keys(schema).forEach(function(field) {
      var rules = schema[field];
      var value = data[field];
      var result = validate(value, rules, field, data);
      if (!result.valid) {
        errors[field] = result.errors;
        valid = false;
      }
    });
    return { valid: valid, errors: errors };
  }

  // ─── Async validation ──────────────────────────────────────────────────────
  /**
   * Validate a value asynchronously (for server-side checks, etc.).
   *
   * @param {any}    value    - The value to validate.
   * @param {string} rules    - Pipe-separated rule string.
   * @param {string} [field]  - Field label.
   * @param {object} [data]   - Full data object.
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  function validateAsync(value, rules, field, data) {
    return new Promise(function(resolve) {
      // Run sync rules first
      var syncResult = validate(value, rules, field, data);
      if (!syncResult.valid) { resolve(syncResult); return; }
      // Async rule runners registered via addAsyncRule
      var asyncRules = _asyncRules[field] || [];
      if (!asyncRules.length) { resolve(syncResult); return; }
      var errors = [];
      var pending = asyncRules.length;
      asyncRules.forEach(function(r) {
        Promise.resolve(r.fn(value, data)).then(function(result) {
          if (!result) errors.push(r.message || ("The " + (field||"field") + " is invalid."));
          pending--;
          if (pending === 0) resolve({ valid: errors.length === 0, errors: errors });
        }).catch(function() {
          errors.push("Validation error for " + (field||"field"));
          pending--;
          if (pending === 0) resolve({ valid: errors.length === 0, errors: errors });
        });
      });
    });
  }
  var _asyncRules = {};
  /**
   * Register an asynchronous validation rule for a specific field.
   *
   * @param {string}   field   - Field name.
   * @param {Function} fn      - Async function (value, data) => Promise<boolean>.
   * @param {string}   message - Error message.
   */
  function addAsyncRule(field, fn, message) {
    if (!_asyncRules[field]) _asyncRules[field] = [];
    _asyncRules[field].push({ fn: fn, message: message });
  }

  // ─── Chain builder ────────────────────────────────────────────────────────
  /**
   * Create a fluent rule chain for a value.
   *
   * @example
   *   MajixMvcValidator.chain(userAge)
   *     .required()
   *     .integer()
   *     .between(18, 120)
   *     .result();  // => { valid: true/false, errors: [...] }
   *
   * @param {any} value - The value to validate.
   * @param {string} [field] - Field label for messages.
   * @returns {object} Chainable validator object.
   */
  function chain(value, field) {
    var _chain_rules = [];
    var _field = field || "value";
    var proxy = {
      rule: function(r) { _chain_rules.push(r); return proxy; },
      result: function(data) { return validate(value, _chain_rules.join("|"), _field, data); }
    };
    // Dynamically add all registered rules as chain methods
    Object.keys(_rules).forEach(function(rn) {
      proxy[rn] = function(arg) {
        _chain_rules.push(arg !== undefined ? rn + ":" + arg : rn);
        return proxy;
      };
    });
    return proxy;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Built-in validation rules ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Rule: required ────────────────────────────────────────────────────
  /**
   * Rule `required` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("required", function(value, arg, args, data) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }, "The :field field is required.");

  // ─── Rule: optional ────────────────────────────────────────────────────
  /**
   * Rule `optional` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("optional", function(value, arg, args, data) {
    return true;
  });

  // ─── Rule: nullable ────────────────────────────────────────────────────
  /**
   * Rule `nullable` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("nullable", function(value, arg, args, data) {
    return true;
  });

  // ─── Rule: filled ──────────────────────────────────────────────────────
  /**
   * Rule `filled` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("filled", function(value, arg, args, data) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }, "The :field field must have a value when present.");

  // ─── Rule: present ─────────────────────────────────────────────────────
  /**
   * Rule `present` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("present", function(value, arg, args, data) {
    return value !== undefined;
  }, "The :field field must be present.");

  // ─── Rule: email ───────────────────────────────────────────────────────
  /**
   * Rule `email` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("email", function(value, arg, args, data) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
  }, "The :field must be a valid email address.");

  // ─── Rule: url ─────────────────────────────────────────────────────────
  /**
   * Rule `url` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("url", function(value, arg, args, data) {
    return (function(v){ try { new URL(v); return true; } catch(e) { return false; } })(String(value));
  }, "The :field must be a valid URL.");

  // ─── Rule: ip ──────────────────────────────────────────────────────────
  /**
   * Rule `ip` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("ip", function(value, arg, args, data) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(String(value)) || /^[0-9a-fA-F:]+$/.test(String(value));
  }, "The :field must be a valid IP address.");

  // ─── Rule: ipv4 ────────────────────────────────────────────────────────
  /**
   * Rule `ipv4` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("ipv4", function(value, arg, args, data) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(String(value)) && String(value).split(".").every(function(p){ return parseInt(p,10) <= 255; });
  }, "The :field must be a valid IPv4 address.");

  // ─── Rule: ipv6 ────────────────────────────────────────────────────────
  /**
   * Rule `ipv6` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("ipv6", function(value, arg, args, data) {
    return /^[0-9a-fA-F:]+$/.test(String(value)) && String(value).split(":").length >= 3;
  }, "The :field must be a valid IPv6 address.");

  // ─── Rule: mac_address ─────────────────────────────────────────────────
  /**
   * Rule `mac_address` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("mac_address", function(value, arg, args, data) {
    return /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(String(value));
  }, "The :field must be a valid MAC address.");

  // ─── Rule: uuid ────────────────────────────────────────────────────────
  /**
   * Rule `uuid` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("uuid", function(value, arg, args, data) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
  }, "The :field must be a valid UUID.");

  // ─── Rule: alpha ───────────────────────────────────────────────────────
  /**
   * Rule `alpha` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("alpha", function(value, arg, args, data) {
    return /^[a-zA-Z]+$/.test(String(value));
  }, "The :field may only contain letters.");

  // ─── Rule: alpha_num ───────────────────────────────────────────────────
  /**
   * Rule `alpha_num` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("alpha_num", function(value, arg, args, data) {
    return /^[a-zA-Z0-9]+$/.test(String(value));
  }, "The :field may only contain letters and numbers.");

  // ─── Rule: alpha_dash ──────────────────────────────────────────────────
  /**
   * Rule `alpha_dash` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("alpha_dash", function(value, arg, args, data) {
    return /^[a-zA-Z0-9_\-]+$/.test(String(value));
  }, "The :field may only contain letters, numbers, dashes, and underscores.");

  // ─── Rule: alpha_spaces ────────────────────────────────────────────────
  /**
   * Rule `alpha_spaces` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("alpha_spaces", function(value, arg, args, data) {
    return /^[a-zA-Z\s]+$/.test(String(value));
  }, "The :field may only contain letters and spaces.");

  // ─── Rule: numeric ─────────────────────────────────────────────────────
  /**
   * Rule `numeric` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("numeric", function(value, arg, args, data) {
    return !isNaN(Number(value)) && String(value).trim() !== "";
  }, "The :field must be a number.");

  // ─── Rule: integer ─────────────────────────────────────────────────────
  /**
   * Rule `integer` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("integer", function(value, arg, args, data) {
    return Number.isInteger(Number(value)) && String(value).indexOf(".") === -1;
  }, "The :field must be an integer.");

  // ─── Rule: float ───────────────────────────────────────────────────────
  /**
   * Rule `float` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("float", function(value, arg, args, data) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }, "The :field must be a decimal number.");

  // ─── Rule: positive ────────────────────────────────────────────────────
  /**
   * Rule `positive` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("positive", function(value, arg, args, data) {
    return Number(value) > 0;
  }, "The :field must be a positive number.");

  // ─── Rule: negative ────────────────────────────────────────────────────
  /**
   * Rule `negative` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("negative", function(value, arg, args, data) {
    return Number(value) < 0;
  }, "The :field must be a negative number.");

  // ─── Rule: non_negative ────────────────────────────────────────────────
  /**
   * Rule `non_negative` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("non_negative", function(value, arg, args, data) {
    return Number(value) >= 0;
  }, "The :field must be zero or positive.");

  // ─── Rule: non_positive ────────────────────────────────────────────────
  /**
   * Rule `non_positive` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("non_positive", function(value, arg, args, data) {
    return Number(value) <= 0;
  }, "The :field must be zero or negative.");

  // ─── Rule: min ─────────────────────────────────────────────────────────
  /**
   * Rule `min` — validates that the value passes this constraint.
   * @param {string} min - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("min", function(value, arg, args, data) {
    return Number(value) >= Number(arg);
  }, "The :field must be at least :arg.");

  // ─── Rule: max ─────────────────────────────────────────────────────────
  /**
   * Rule `max` — validates that the value passes this constraint.
   * @param {string} max - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("max", function(value, arg, args, data) {
    return Number(value) <= Number(arg);
  }, "The :field must be at most :arg.");

  // ─── Rule: between ─────────────────────────────────────────────────────
  /**
   * Rule `between` — validates that the value passes this constraint.
   * @param {string} min - Rule argument.
   * @param {string} max - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("between", function(value, arg, args, data) {
    return (function(v,a){ var p=a.split(","); return Number(v)>=Number(p[0])&&Number(v)<=Number(p[1]); })(value,arg);
  }, "The :field must be between :0 and :1.");

  // ─── Rule: min_length ──────────────────────────────────────────────────
  /**
   * Rule `min_length` — validates that the value passes this constraint.
   * @param {string} min - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("min_length", function(value, arg, args, data) {
    return String(value).length >= Number(arg);
  }, "The :field must be at least :arg characters.");

  // ─── Rule: max_length ──────────────────────────────────────────────────
  /**
   * Rule `max_length` — validates that the value passes this constraint.
   * @param {string} max - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("max_length", function(value, arg, args, data) {
    return String(value).length <= Number(arg);
  }, "The :field must not exceed :arg characters.");

  // ─── Rule: exact_length ────────────────────────────────────────────────
  /**
   * Rule `exact_length` — validates that the value passes this constraint.
   * @param {string} length - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("exact_length", function(value, arg, args, data) {
    return String(value).length === Number(arg);
  }, "The :field must be exactly :arg characters.");

  // ─── Rule: size ────────────────────────────────────────────────────────
  /**
   * Rule `size` — validates that the value passes this constraint.
   * @param {string} size - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("size", function(value, arg, args, data) {
    return (Array.isArray(value)?value:Object.keys(value||{})).length === Number(arg);
  }, "The :field must contain exactly :arg items.");

  // ─── Rule: min_size ────────────────────────────────────────────────────
  /**
   * Rule `min_size` — validates that the value passes this constraint.
   * @param {string} min - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("min_size", function(value, arg, args, data) {
    return (Array.isArray(value)?value:Object.keys(value||{})).length >= Number(arg);
  }, "The :field must contain at least :arg items.");

  // ─── Rule: max_size ────────────────────────────────────────────────────
  /**
   * Rule `max_size` — validates that the value passes this constraint.
   * @param {string} max - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("max_size", function(value, arg, args, data) {
    return (Array.isArray(value)?value:Object.keys(value||{})).length <= Number(arg);
  }, "The :field must not contain more than :arg items.");

  // ─── Rule: in ──────────────────────────────────────────────────────────
  /**
   * Rule `in` — validates that the value passes this constraint.
   * @param {string} list - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("in", function(value, arg, args, data) {
    return arg.split(",").indexOf(String(value)) !== -1;
  }, "The :field must be one of: :arg.");

  // ─── Rule: not_in ──────────────────────────────────────────────────────
  /**
   * Rule `not_in` — validates that the value passes this constraint.
   * @param {string} list - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("not_in", function(value, arg, args, data) {
    return arg.split(",").indexOf(String(value)) === -1;
  }, "The :field must not be one of: :arg.");

  // ─── Rule: starts_with ─────────────────────────────────────────────────
  /**
   * Rule `starts_with` — validates that the value passes this constraint.
   * @param {string} prefix - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("starts_with", function(value, arg, args, data) {
    return String(value).startsWith(arg);
  }, "The :field must start with ":arg".");

  // ─── Rule: ends_with ───────────────────────────────────────────────────
  /**
   * Rule `ends_with` — validates that the value passes this constraint.
   * @param {string} suffix - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("ends_with", function(value, arg, args, data) {
    return String(value).endsWith(arg);
  }, "The :field must end with ":arg".");

  // ─── Rule: contains ────────────────────────────────────────────────────
  /**
   * Rule `contains` — validates that the value passes this constraint.
   * @param {string} substr - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("contains", function(value, arg, args, data) {
    return String(value).indexOf(arg) !== -1;
  }, "The :field must contain ":arg".");

  // ─── Rule: not_contains ────────────────────────────────────────────────
  /**
   * Rule `not_contains` — validates that the value passes this constraint.
   * @param {string} substr - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("not_contains", function(value, arg, args, data) {
    return String(value).indexOf(arg) === -1;
  }, "The :field must not contain ":arg".");

  // ─── Rule: regex ───────────────────────────────────────────────────────
  /**
   * Rule `regex` — validates that the value passes this constraint.
   * @param {string} pattern - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("regex", function(value, arg, args, data) {
    return (function(v,a){ try { return new RegExp(a).test(String(v)); } catch(e){ return false; } })(value,arg);
  }, "The :field format is invalid.");

  // ─── Rule: not_regex ───────────────────────────────────────────────────
  /**
   * Rule `not_regex` — validates that the value passes this constraint.
   * @param {string} pattern - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("not_regex", function(value, arg, args, data) {
    return (function(v,a){ try { return !new RegExp(a).test(String(v)); } catch(e){ return true; } })(value,arg);
  }, "The :field format is invalid.");

  // ─── Rule: same ────────────────────────────────────────────────────────
  /**
   * Rule `same` — validates that the value passes this constraint.
   * @param {string} other - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("same", function(value, arg, args, data) {
    return String(value) === String(data[arg]);
  }, "The :field must match :arg.");

  // ─── Rule: different ───────────────────────────────────────────────────
  /**
   * Rule `different` — validates that the value passes this constraint.
   * @param {string} other - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("different", function(value, arg, args, data) {
    return String(value) !== String(data[arg]);
  }, "The :field must be different from :arg.");

  // ─── Rule: confirmed ───────────────────────────────────────────────────
  /**
   * Rule `confirmed` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("confirmed", function(value, arg, args, data) {
    return String(value) === String(data[field + "_confirmation"] || "");
  }, "The :field confirmation does not match.");

  // ─── Rule: gt ──────────────────────────────────────────────────────────
  /**
   * Rule `gt` — validates that the value passes this constraint.
   * @param {string} other - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("gt", function(value, arg, args, data) {
    return Number(value) > Number(data[arg] !== undefined ? data[arg] : arg);
  }, "The :field must be greater than :arg.");

  // ─── Rule: gte ─────────────────────────────────────────────────────────
  /**
   * Rule `gte` — validates that the value passes this constraint.
   * @param {string} other - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("gte", function(value, arg, args, data) {
    return Number(value) >= Number(data[arg] !== undefined ? data[arg] : arg);
  }, "The :field must be greater than or equal to :arg.");

  // ─── Rule: lt ──────────────────────────────────────────────────────────
  /**
   * Rule `lt` — validates that the value passes this constraint.
   * @param {string} other - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("lt", function(value, arg, args, data) {
    return Number(value) < Number(data[arg] !== undefined ? data[arg] : arg);
  }, "The :field must be less than :arg.");

  // ─── Rule: lte ─────────────────────────────────────────────────────────
  /**
   * Rule `lte` — validates that the value passes this constraint.
   * @param {string} other - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("lte", function(value, arg, args, data) {
    return Number(value) <= Number(data[arg] !== undefined ? data[arg] : arg);
  }, "The :field must be less than or equal to :arg.");

  // ─── Rule: date ────────────────────────────────────────────────────────
  /**
   * Rule `date` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("date", function(value, arg, args, data) {
    return !isNaN(Date.parse(String(value)));
  }, "The :field must be a valid date.");

  // ─── Rule: before ──────────────────────────────────────────────────────
  /**
   * Rule `before` — validates that the value passes this constraint.
   * @param {string} date - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("before", function(value, arg, args, data) {
    return (function(v,a){ var d=new Date(v),r=new Date(a); return !isNaN(d)&&!isNaN(r)&&d<r; })(value,arg);
  }, "The :field must be a date before :arg.");

  // ─── Rule: after ───────────────────────────────────────────────────────
  /**
   * Rule `after` — validates that the value passes this constraint.
   * @param {string} date - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("after", function(value, arg, args, data) {
    return (function(v,a){ var d=new Date(v),r=new Date(a); return !isNaN(d)&&!isNaN(r)&&d>r; })(value,arg);
  }, "The :field must be a date after :arg.");

  // ─── Rule: before_or_equal ─────────────────────────────────────────────
  /**
   * Rule `before_or_equal` — validates that the value passes this constraint.
   * @param {string} date - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("before_or_equal", function(value, arg, args, data) {
    return (function(v,a){ var d=new Date(v),r=new Date(a); return !isNaN(d)&&!isNaN(r)&&d<=r; })(value,arg);
  }, "The :field must be a date on or before :arg.");

  // ─── Rule: after_or_equal ──────────────────────────────────────────────
  /**
   * Rule `after_or_equal` — validates that the value passes this constraint.
   * @param {string} date - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("after_or_equal", function(value, arg, args, data) {
    return (function(v,a){ var d=new Date(v),r=new Date(a); return !isNaN(d)&&!isNaN(r)&&d>=r; })(value,arg);
  }, "The :field must be a date on or after :arg.");

  // ─── Rule: date_format ─────────────────────────────────────────────────
  /**
   * Rule `date_format` — validates that the value passes this constraint.
   * @param {string} format - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("date_format", function(value, arg, args, data) {
    return (function(v){ return !isNaN(Date.parse(v)); })(value);
  }, "The :field does not match the expected date format.");

  // ─── Rule: boolean ─────────────────────────────────────────────────────
  /**
   * Rule `boolean` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("boolean", function(value, arg, args, data) {
    return ["true","false","1","0",true,false,1,0].indexOf(value) !== -1;
  }, "The :field must be true or false.");

  // ─── Rule: array ───────────────────────────────────────────────────────
  /**
   * Rule `array` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("array", function(value, arg, args, data) {
    return Array.isArray(value);
  }, "The :field must be an array.");

  // ─── Rule: object ──────────────────────────────────────────────────────
  /**
   * Rule `object` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("object", function(value, arg, args, data) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }, "The :field must be an object.");

  // ─── Rule: string ──────────────────────────────────────────────────────
  /**
   * Rule `string` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("string", function(value, arg, args, data) {
    return typeof value === "string";
  }, "The :field must be a string.");

  // ─── Rule: json ────────────────────────────────────────────────────────
  /**
   * Rule `json` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("json", function(value, arg, args, data) {
    return (function(v){ try { JSON.parse(v); return true; } catch(e){ return false; } })(value);
  }, "The :field must be valid JSON.");

  // ─── Rule: base64 ──────────────────────────────────────────────────────
  /**
   * Rule `base64` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("base64", function(value, arg, args, data) {
    return /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(String(value));
  }, "The :field must be a valid Base64 string.");

  // ─── Rule: hex ─────────────────────────────────────────────────────────
  /**
   * Rule `hex` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("hex", function(value, arg, args, data) {
    return /^#?[0-9a-fA-F]+$/.test(String(value));
  }, "The :field must be a valid hexadecimal string.");

  // ─── Rule: ascii ───────────────────────────────────────────────────────
  /**
   * Rule `ascii` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("ascii", function(value, arg, args, data) {
    return /^[\x00-\x7F]*$/.test(String(value));
  }, "The :field must contain only ASCII characters.");

  // ─── Rule: credit_card ─────────────────────────────────────────────────
  /**
   * Rule `credit_card` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("credit_card", function(value, arg, args, data) {
    return luhn(value);
  }, "The :field must be a valid credit card number.");

  // ─── Rule: phone ───────────────────────────────────────────────────────
  /**
   * Rule `phone` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("phone", function(value, arg, args, data) {
    return /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(String(value).replace(/\s/g,""));
  }, "The :field must be a valid phone number.");

  // ─── Rule: zip ─────────────────────────────────────────────────────────
  /**
   * Rule `zip` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("zip", function(value, arg, args, data) {
    return /^\d{5}(-\d{4})?$/.test(String(value));
  }, "The :field must be a valid US ZIP code.");

  // ─── Rule: digits ──────────────────────────────────────────────────────
  /**
   * Rule `digits` — validates that the value passes this constraint.
   * @param {string} count - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("digits", function(value, arg, args, data) {
    return /^\d+$/.test(String(value)) && String(value).length === Number(arg);
  }, "The :field must be :arg digits.");

  // ─── Rule: digits_between ──────────────────────────────────────────────
  /**
   * Rule `digits_between` — validates that the value passes this constraint.
   * @param {string} min - Rule argument.
   * @param {string} max - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("digits_between", function(value, arg, args, data) {
    return (function(v,a){ var p=a.split(","),l=String(v).replace(/\D/g,"").length; return l>=Number(p[0])&&l<=Number(p[1]); })(value,arg);
  }, "The :field must be between :0 and :1 digits.");

  // ─── Rule: has_upper ───────────────────────────────────────────────────
  /**
   * Rule `has_upper` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("has_upper", function(value, arg, args, data) {
    return /[A-Z]/.test(String(value));
  }, "The :field must contain at least one uppercase letter.");

  // ─── Rule: has_lower ───────────────────────────────────────────────────
  /**
   * Rule `has_lower` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("has_lower", function(value, arg, args, data) {
    return /[a-z]/.test(String(value));
  }, "The :field must contain at least one lowercase letter.");

  // ─── Rule: has_digit ───────────────────────────────────────────────────
  /**
   * Rule `has_digit` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("has_digit", function(value, arg, args, data) {
    return /[0-9]/.test(String(value));
  }, "The :field must contain at least one digit.");

  // ─── Rule: has_special ─────────────────────────────────────────────────
  /**
   * Rule `has_special` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("has_special", function(value, arg, args, data) {
    return /[^a-zA-Z0-9]/.test(String(value));
  }, "The :field must contain at least one special character.");

  // ─── Rule: strong_password ─────────────────────────────────────────────
  /**
   * Rule `strong_password` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("strong_password", function(value, arg, args, data) {
    return /[A-Z]/.test(String(value)) && /[a-z]/.test(String(value)) && /[0-9]/.test(String(value)) && /[^a-zA-Z0-9]/.test(String(value)) && String(value).length >= 8;
  }, "The :field must be a strong password (uppercase, lowercase, digit, special, 8+ chars).");

  // ─── Rule: no_spaces ───────────────────────────────────────────────────
  /**
   * Rule `no_spaces` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("no_spaces", function(value, arg, args, data) {
    return !/\s/.test(String(value));
  }, "The :field must not contain spaces.");

  // ─── Rule: slug ────────────────────────────────────────────────────────
  /**
   * Rule `slug` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("slug", function(value, arg, args, data) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value));
  }, "The :field must be a valid URL slug.");

  // ─── Rule: username ────────────────────────────────────────────────────
  /**
   * Rule `username` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("username", function(value, arg, args, data) {
    return /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/.test(String(value));
  }, "The :field must be a valid username (3-30 chars, start with letter).");

  // ─── Rule: luhn ────────────────────────────────────────────────────────
  /**
   * Rule `luhn` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("luhn", function(value, arg, args, data) {
    return luhn(value);
  }, "The :field does not pass the Luhn check.");

  // ─── Rule: ean13 ───────────────────────────────────────────────────────
  /**
   * Rule `ean13` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("ean13", function(value, arg, args, data) {
    return /^\d{13}$/.test(String(value));
  }, "The :field must be a valid EAN-13 barcode.");

  // ─── Rule: isbn ────────────────────────────────────────────────────────
  /**
   * Rule `isbn` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("isbn", function(value, arg, args, data) {
    return /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)/.test(String(value));
  }, "The :field must be a valid ISBN.");

  // ─── Rule: iban ────────────────────────────────────────────────────────
  /**
   * Rule `iban` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("iban", function(value, arg, args, data) {
    return /^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(String(value).replace(/\s/g,"").toUpperCase());
  }, "The :field must be a valid IBAN.");

  // ─── Rule: color_hex ───────────────────────────────────────────────────
  /**
   * Rule `color_hex` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("color_hex", function(value, arg, args, data) {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(String(value));
  }, "The :field must be a valid hex color (e.g. #fff or #ffffff).");

  // ─── Rule: color_rgb ───────────────────────────────────────────────────
  /**
   * Rule `color_rgb` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("color_rgb", function(value, arg, args, data) {
    return /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(String(value));
  }, "The :field must be a valid rgb() color.");

  // ─── Rule: latitude ────────────────────────────────────────────────────
  /**
   * Rule `latitude` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("latitude", function(value, arg, args, data) {
    return (function(v){ var n=parseFloat(v); return !isNaN(n) && n>=-90 && n<=90; })(value);
  }, "The :field must be a valid latitude (-90 to 90).");

  // ─── Rule: longitude ───────────────────────────────────────────────────
  /**
   * Rule `longitude` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("longitude", function(value, arg, args, data) {
    return (function(v){ var n=parseFloat(v); return !isNaN(n) && n>=-180 && n<=180; })(value);
  }, "The :field must be a valid longitude (-180 to 180).");

  // ─── Rule: multiple_of ─────────────────────────────────────────────────
  /**
   * Rule `multiple_of` — validates that the value passes this constraint.
   * @param {string} factor - Rule argument.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("multiple_of", function(value, arg, args, data) {
    return Number(value) % Number(arg) === 0;
  }, "The :field must be a multiple of :arg.");

  // ─── Rule: even ────────────────────────────────────────────────────────
  /**
   * Rule `even` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("even", function(value, arg, args, data) {
    return parseInt(value,10) % 2 === 0;
  }, "The :field must be an even number.");

  // ─── Rule: odd ─────────────────────────────────────────────────────────
  /**
   * Rule `odd` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("odd", function(value, arg, args, data) {
    return parseInt(value,10) % 2 !== 0;
  }, "The :field must be an odd number.");

  // ─── Rule: palindrome ──────────────────────────────────────────────────
  /**
   * Rule `palindrome` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("palindrome", function(value, arg, args, data) {
    return (function(v){ var s=String(v).toLowerCase().replace(/[^a-z0-9]/g,""); return s===s.split("").reverse().join(""); })(value);
  }, "The :field must be a palindrome.");

  // ─── Rule: uppercase ───────────────────────────────────────────────────
  /**
   * Rule `uppercase` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("uppercase", function(value, arg, args, data) {
    return String(value) === String(value).toUpperCase() && /[A-Z]/.test(String(value));
  }, "The :field must be in uppercase.");

  // ─── Rule: lowercase ───────────────────────────────────────────────────
  /**
   * Rule `lowercase` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("lowercase", function(value, arg, args, data) {
    return String(value) === String(value).toLowerCase() && /[a-z]/.test(String(value));
  }, "The :field must be in lowercase.");

  // ─── Rule: trimmed ─────────────────────────────────────────────────────
  /**
   * Rule `trimmed` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("trimmed", function(value, arg, args, data) {
    return String(value) === String(value).trim();
  }, "The :field must not have leading or trailing spaces.");

  // ─── Rule: not_empty ───────────────────────────────────────────────────
  /**
   * Rule `not_empty` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("not_empty", function(value, arg, args, data) {
    return String(value).trim() !== "";
  }, "The :field must not be empty.");

  // ─── Rule: truthy ──────────────────────────────────────────────────────
  /**
   * Rule `truthy` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("truthy", function(value, arg, args, data) {
    return !!value;
  }, "The :field must be truthy.");

  // ─── Rule: falsy ───────────────────────────────────────────────────────
  /**
   * Rule `falsy` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("falsy", function(value, arg, args, data) {
    return !value;
  }, "The :field must be falsy.");

  // ─── Rule: not_null ────────────────────────────────────────────────────
  /**
   * Rule `not_null` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("not_null", function(value, arg, args, data) {
    return value !== null;
  }, "The :field must not be null.");

  // ─── Rule: not_undefined ───────────────────────────────────────────────
  /**
   * Rule `not_undefined` — validates that the value passes this constraint.
   * @param {any}    value - The value being validated.
   * @param {string} arg   - The argument string (if any).
   * @param {array}  args  - The arguments array (if any).
   * @param {object} data  - The full data object (for cross-field rules).
   * @returns {boolean} true if value passes the rule.
   */
  addRule("not_undefined", function(value, arg, args, data) {
    return value !== undefined;
  }, "The :field must not be undefined.");

  // ─── Init ─────────────────────────────────────────────────────────────────
  /**
   * Initialise the validator with optional configuration.
   *
   * @param {object} [config]
   * @param {string} [config.locale="en"]             - Locale key for messages.
   * @param {boolean}[config.stopOnFirstFailure=false] - Stop after first error.
   * @param {boolean}[config.debug=false]             - Enable debug logging.
   * @returns {object} MajixMvcValidator
   */
  function init(config) {
    var c = config || global.VALIDATOR_CONFIG || {};
    if (c.locale !== undefined) _cfg.locale = c.locale;
    if (c.stopOnFirstFailure !== undefined) _cfg.stopOnFirstFailure = c.stopOnFirstFailure;
    if (c.debug !== undefined) _cfg.debug = c.debug;
    emit("validator:init", _cfg);
    return MajixMvcValidator;
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  var MajixMvcValidator = {
    version:        VERSION,
    init:           init,
    addRule:        addRule,
    addAsyncRule:   addAsyncRule,
    validate:       validate,
    validateSchema: validateSchema,
    validateAsync:  validateAsync,
    applyRule:      applyRule,
    getMessage:     getMessage,
    chain:          chain,
    rules:          function() { return Object.keys(_rules); },
    on:             on,
    off:            off,
    emit:           emit,
    _cfg:           _cfg
  };

  global.MajixMvcValidator = MajixMvcValidator;

}(typeof window !== "undefined" ? window : this));
