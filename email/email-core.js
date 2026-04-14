// /email/email-core.js  —  Shared Email Library for MajixAI
//
// Usage: set window.EMAIL_CONFIG then call MajixEmail.init()
//
// EMAIL_CONFIG options (all optional):
//
//   serviceId         {string}
//     EmailJS service ID (required when provider === 'emailjs').
//     default: ''
//
//   templateId        {string}
//     EmailJS template ID (required when provider === 'emailjs').
//     default: ''
//
//   publicKey         {string}
//     EmailJS public key (required when provider === 'emailjs').
//     default: ''
//
//   provider          'emailjs' | 'formsubmit' | 'mailto'
//     Transport used when MajixEmail.send() is called.
//     'emailjs'     — sends via EmailJS SDK (must set serviceId/templateId/publicKey)
//     'formsubmit'  — POSTs to https://formsubmit.co/<toEmail>
//     'mailto'      — opens native mail client via mailto: link
//     default: 'mailto'
//
//   toEmail           {string}
//     Default recipient address used by formsubmit and mailto providers.
//     default: ''
//
//   fromName          {string}
//     Default sender name pre-filled in compose forms.
//     default: ''
//
//   subject           {string}
//     Default subject line.
//     default: ''
//
//   templates         { [name: string]: { subject: string, body: string } }
//     Named email templates.  Variables wrapped in {{var}} are replaced
//     by MajixEmail.render(name, vars).
//     default: {}
//
//   maxHistory        {number}
//     Maximum number of sent email records kept in localStorage.
//     default: 50
//
//   storageKey        {string}
//     localStorage key used to persist email history.
//     default: 'majix-email-history'
//
//   onSend            {function(payload): void}
//     Callback invoked after every successful send.
//     default: null
//
//   onError           {function(err): void}
//     Callback invoked on send failure.
//     default: null
//
//   debug             {boolean}
//     When true, all operations are logged to the console.
//     default: false

(function (root) {
  'use strict';

  // ── Utilities ──────────────────────────────────────────────────────────────

  function _log(...args) {
    if (MajixEmail._cfg.debug) console.log('[MajixEmail]', ...args);
  }

  function _err(...args) {
    console.error('[MajixEmail]', ...args);
  }

  function _isValidEmail(addr) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(addr).trim());
  }

  function _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Default configuration ──────────────────────────────────────────────────

  const DEFAULTS = {
    serviceId:   '',
    templateId:  '',
    publicKey:   '',
    provider:    'mailto',
    toEmail:     '',
    fromName:    '',
    subject:     '',
    templates:   {},
    maxHistory:  50,
    storageKey:  'majix-email-history',
    onSend:      null,
    onError:     null,
    debug:       false,
  };

  // ── Core object ───────────────────────────────────────────────────────────

  const MajixEmail = {
    _cfg:          Object.assign({}, DEFAULTS),
    _ready:        false,
    _emailjsReady: false,

    // ── Initialise ─────────────────────────────────────────────────────────

    init(config) {
      const userCfg = (config != null) ? config
                    : (root.EMAIL_CONFIG != null) ? root.EMAIL_CONFIG
                    : {};
      this._cfg = Object.assign({}, DEFAULTS, userCfg);
      this._ready = true;
      _log('init', this._cfg);

      if (this._cfg.provider === 'emailjs') {
        this._initEmailJS();
      }
      return this;
    },

    _initEmailJS() {
      if (typeof emailjs !== 'undefined' && this._cfg.publicKey) {
        emailjs.init(this._cfg.publicKey);
        this._emailjsReady = true;
        _log('EmailJS initialised');
      } else {
        _log('EmailJS SDK not loaded yet — it will be initialised on first send');
      }
    },

    // ── Validation ─────────────────────────────────────────────────────────

    validate(payload) {
      const errors = [];
      if (!payload) { errors.push('Payload is required'); return errors; }
      if (payload.to && !_isValidEmail(payload.to)) {
        errors.push(`Invalid "to" address: ${payload.to}`);
      }
      if (payload.from && !_isValidEmail(payload.from)) {
        errors.push(`Invalid "from" address: ${payload.from}`);
      }
      if (!payload.subject && !this._cfg.subject) {
        errors.push('"subject" is required');
      }
      if (!payload.body && !payload.message) {
        errors.push('"body" or "message" is required');
      }
      return errors;
    },

    // ── Template rendering ─────────────────────────────────────────────────

    render(templateName, vars) {
      const tpl = this._cfg.templates[templateName];
      if (!tpl) { _err(`Template "${templateName}" not found`); return null; }
      const replace = (str) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
      return {
        subject: replace(tpl.subject || ''),
        body:    replace(tpl.body    || ''),
      };
    },

    // ── Send ───────────────────────────────────────────────────────────────

    async send(payload) {
      if (!this._ready) { throw new Error('MajixEmail.init() has not been called'); }

      const errors = this.validate(payload);
      if (errors.length) {
        const err = new Error('Validation failed: ' + errors.join('; '));
        if (this._cfg.onError) this._cfg.onError(err);
        throw err;
      }

      const envelope = this._buildEnvelope(payload);
      _log('send', envelope);

      try {
        switch (this._cfg.provider) {
          case 'emailjs':
            await this._sendEmailJS(envelope);
            break;
          case 'formsubmit':
            await this._sendFormSubmit(envelope);
            break;
          case 'mailto':
          default:
            this._openMailto(envelope);
            break;
        }
        this._saveHistory(envelope);
        if (this._cfg.onSend) this._cfg.onSend(envelope);
        _log('sent', envelope);
        return envelope;
      } catch (err) {
        _err('send error', err);
        if (this._cfg.onError) this._cfg.onError(err);
        throw err;
      }
    },

    _buildEnvelope(payload) {
      return {
        to:        payload.to       || this._cfg.toEmail   || '',
        from:      payload.from     || '',
        fromName:  payload.fromName || this._cfg.fromName  || '',
        subject:   payload.subject  || this._cfg.subject   || '',
        body:      payload.body     || payload.message     || '',
        replyTo:   payload.replyTo  || payload.from        || '',
        timestamp: new Date().toISOString(),
      };
    },

    // ── EmailJS provider ──────────────────────────────────────────────────

    async _sendEmailJS(env) {
      if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS SDK is not loaded. Include <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script> before email-core.js.');
      }
      if (!this._emailjsReady && this._cfg.publicKey) {
        emailjs.init(this._cfg.publicKey);
        this._emailjsReady = true;
      }
      if (!this._cfg.serviceId || !this._cfg.templateId) {
        throw new Error('emailjs provider requires serviceId and templateId in EMAIL_CONFIG');
      }
      const params = {
        to_email:   env.to,
        from_name:  env.fromName || env.from,
        from_email: env.from,
        reply_to:   env.replyTo,
        subject:    env.subject,
        message:    env.body,
      };
      return emailjs.send(this._cfg.serviceId, this._cfg.templateId, params);
    },

    // ── FormSubmit provider ───────────────────────────────────────────────

    async _sendFormSubmit(env) {
      const target = env.to || this._cfg.toEmail;
      if (!target || !_isValidEmail(target)) {
        throw new Error('formsubmit provider requires a valid toEmail in EMAIL_CONFIG');
      }
      const formData = new FormData();
      formData.append('_subject',  env.subject);
      formData.append('name',      env.fromName || env.from);
      formData.append('email',     env.from);
      formData.append('message',   env.body);
      formData.append('_replyto',  env.replyTo);
      formData.append('_captcha',  'false');
      const res = await fetch(`https://formsubmit.co/${encodeURIComponent(target)}`, {
        method:  'POST',
        body:    formData,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`FormSubmit responded with ${res.status}`);
      return res.json();
    },

    // ── Mailto provider ───────────────────────────────────────────────────

    _openMailto(env) {
      const to      = encodeURIComponent(env.to);
      const subject = encodeURIComponent(env.subject);
      const body    = encodeURIComponent(env.body);
      const cc      = env.replyTo ? `&cc=${encodeURIComponent(env.replyTo)}` : '';
      const link    = `mailto:${to}?subject=${subject}&body=${body}${cc}`;
      if (root.open) {
        root.open(link, '_self');
      } else {
        const a = document.createElement('a');
        a.href = link;
        a.click();
      }
    },

    // ── History ───────────────────────────────────────────────────────────

    _saveHistory(env) {
      try {
        const key     = this._cfg.storageKey;
        const history = this.getHistory();
        history.unshift(Object.assign({}, env));
        if (history.length > this._cfg.maxHistory) {
          history.length = this._cfg.maxHistory;
        }
        localStorage.setItem(key, JSON.stringify(history));
      } catch (e) {
        _err('history save failed', e);
      }
    },

    getHistory() {
      try {
        return JSON.parse(localStorage.getItem(this._cfg.storageKey) || '[]');
      } catch (_e) {
        return [];
      }
    },

    clearHistory() {
      try {
        localStorage.removeItem(this._cfg.storageKey);
        _log('history cleared');
      } catch (e) {
        _err('history clear failed', e);
      }
    },

    // ── Compose helpers ───────────────────────────────────────────────────

    buildMailtoLink(payload) {
      const env     = this._buildEnvelope(payload);
      const to      = encodeURIComponent(env.to);
      const subject = encodeURIComponent(env.subject);
      const body    = encodeURIComponent(env.body);
      return `mailto:${to}?subject=${subject}&body=${body}`;
    },

    // ── Form binding ──────────────────────────────────────────────────────

    // Attach to an HTML <form> element.  Reads fields by name:
    //   name="to" | "from" | "from_name" | "subject" | "body" | "message"
    // Submits via the configured provider on form submit event.
    bindForm(formEl, opts) {
      if (!formEl) { _err('bindForm: element not found'); return; }
      opts = opts || {};
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data    = new FormData(formEl);
        const payload = {
          to:       data.get('to')        || opts.to        || this._cfg.toEmail,
          from:     data.get('from')      || data.get('email') || '',
          fromName: data.get('from_name') || data.get('name')  || this._cfg.fromName,
          subject:  data.get('subject')   || this._cfg.subject,
          body:     data.get('body')      || data.get('message') || '',
          replyTo:  data.get('reply_to')  || '',
        };
        const statusEl = opts.statusEl || formEl.querySelector('[data-email-status]');
        try {
          if (statusEl) { statusEl.textContent = 'Sending\u2026'; statusEl.className = 'email-status sending'; }
          await this.send(payload);
          if (opts.onSuccess) opts.onSuccess(payload);
          if (statusEl) { statusEl.textContent = 'Sent!'; statusEl.className = 'email-status success'; }
          if (opts.resetOnSuccess !== false) formEl.reset();
        } catch (err) {
          if (opts.onError) opts.onError(err);
          if (statusEl) { statusEl.textContent = `Error: ${_escape(err.message)}`; statusEl.className = 'email-status error'; }
        }
      });
      _log('bindForm attached', formEl);
    },
  };

  // ── Export ────────────────────────────────────────────────────────────────

  root.MajixEmail = MajixEmail;

}(typeof window !== 'undefined' ? window : this));
