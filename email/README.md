# /email — Shared Email Infrastructure

This directory is the single source of truth for email handling across every MajixAI sub-app and directory. Any new or existing app can plug straight in with a few lines of configuration.

## Files

| File | Purpose |
|------|---------|
| `email-core.js` | Unified email library — compose, validate, send, template, history |
| `index.html` | Live demo and full API documentation |

---

## Quick start — adding email to any directory

### 1 — Include `email-core.js`

```html
<!-- Optional: load EmailJS SDK only if you use the 'emailjs' provider -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>

<script src="/email/email-core.js"></script>
```

### 2 — Configure and initialise

```html
<script>
  window.EMAIL_CONFIG = {
    provider: 'mailto',           // 'mailto' | 'emailjs' | 'formsubmit'
    toEmail:  'hello@example.com',
    subject:  'Hello from MajixAI',
  };
  MajixEmail.init();
</script>
```

### 3 — Send an email

```js
// Programmatic send
MajixEmail.send({
  to:      'recipient@example.com',
  from:    'sender@example.com',
  subject: 'My subject',
  body:    'Hello!\n\nThis is a test.',
}).then(function (env) {
  console.log('Sent', env);
}).catch(function (err) {
  console.error('Error', err);
});
```

### 4 — Bind a contact form

```html
<form id="contactForm">
  <input name="name"    placeholder="Your name">
  <input name="email"   placeholder="Your email">
  <input name="subject" placeholder="Subject">
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
  <span data-email-status></span>
</form>

<script>
  MajixEmail.init({ provider: 'formsubmit', toEmail: 'you@example.com' });
  MajixEmail.bindForm(document.getElementById('contactForm'));
</script>
```

---

## Providers

| Provider | How it works | Requirements |
|----------|-------------|--------------|
| `mailto` | Opens the visitor's native mail client via a `mailto:` link | None — works on every static site |
| `emailjs` | Uses the [EmailJS](https://www.emailjs.com/) SDK to send from the browser without a back-end | Free EmailJS account + `serviceId`, `templateId`, `publicKey` |
| `formsubmit` | POSTs form data to [FormSubmit.co](https://formsubmit.co/) | Free FormSubmit account + verified `toEmail` |

---

## EMAIL_CONFIG reference

All fields are **optional**; sensible defaults are applied by `email-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `provider` | string | `'mailto'` | `'mailto'` \| `'emailjs'` \| `'formsubmit'` |
| `toEmail` | string | `''` | Default recipient address |
| `fromName` | string | `''` | Default sender display name |
| `subject` | string | `''` | Default subject line |
| `serviceId` | string | `''` | EmailJS service ID |
| `templateId` | string | `''` | EmailJS template ID |
| `publicKey` | string | `''` | EmailJS public key |
| `templates` | object | `{}` | Named `{ subject, body }` templates with `{{var}}` slots |
| `maxHistory` | number | `50` | Maximum sent records kept in localStorage |
| `storageKey` | string | `'majix-email-history'` | localStorage key for history |
| `onSend` | function | `null` | Callback invoked after every successful send |
| `onError` | function | `null` | Callback invoked on send failure |
| `debug` | boolean | `false` | Log all operations to the console |

---

## API Reference

### `MajixEmail.init(config?)`
Initialise the library.  Pass a config object directly, or set `window.EMAIL_CONFIG` and call with no arguments.  Returns `MajixEmail` for chaining.

### `MajixEmail.send(payload)`
Send an email using the configured provider.  Returns a `Promise` that resolves with the sent envelope.

`payload` fields:

| Field | Description |
|-------|-------------|
| `to` | Recipient address (overrides `toEmail`) |
| `from` | Sender address |
| `fromName` | Sender display name |
| `subject` | Subject line |
| `body` | Plain-text body (`message` is also accepted) |
| `replyTo` | Reply-to address |

### `MajixEmail.validate(payload)`
Validate a payload before sending.  Returns an array of error strings (empty = valid).

### `MajixEmail.render(templateName, vars)`
Render a named template with variable substitution.  Returns `{ subject, body }`.

```js
const msg = MajixEmail.render('welcome', { name: 'Alice' });
// { subject: 'Welcome, Alice!', body: 'Hi Alice, ...' }
```

### `MajixEmail.bindForm(formEl, opts?)`
Attach a send handler to a `<form>` element.  The form is submitted via the configured provider.

Field names read from the form:

| `name` attribute | Mapped to |
|-----------------|-----------|
| `to` | `payload.to` |
| `from` or `email` | `payload.from` |
| `from_name` or `name` | `payload.fromName` |
| `subject` | `payload.subject` |
| `body` or `message` | `payload.body` |
| `reply_to` | `payload.replyTo` |

`opts`:

| Option | Description |
|--------|-------------|
| `to` | Override recipient (fallback if no `to` field) |
| `statusEl` | Element that shows sending/success/error status (auto-detected via `[data-email-status]`) |
| `onSuccess(payload)` | Callback on successful send |
| `onError(err)` | Callback on failure |
| `resetOnSuccess` | Reset the form after success (default: `true`) |

### `MajixEmail.buildMailtoLink(payload)`
Build a `mailto:` URL string without opening the mail client.

### `MajixEmail.getHistory()`
Return the array of sent email envelopes from localStorage.

### `MajixEmail.clearHistory()`
Remove all sent email records from localStorage.

---

## Template system

Define reusable templates in `EMAIL_CONFIG.templates`:

```js
window.EMAIL_CONFIG = {
  provider: 'mailto',
  toEmail:  'support@example.com',
  templates: {
    welcome: {
      subject: 'Welcome, {{name}}!',
      body:    'Hi {{name}},\n\nThanks for joining MajixAI.\n\nBest,\nThe Team',
    },
    reset: {
      subject: 'Password reset for {{email}}',
      body:    'Click the link below to reset your password:\n{{link}}',
    },
  },
};
MajixEmail.init();

// Render and send
const msg = MajixEmail.render('welcome', { name: 'Alice' });
MajixEmail.send({ ...msg, to: 'alice@example.com' });
```

---

## Sent-email history

`email-core.js` automatically stores up to `maxHistory` (default 50) sent envelopes in `localStorage`:

```js
// Read history
const history = MajixEmail.getHistory();
// [{ to, from, fromName, subject, body, replyTo, timestamp }, ...]

// Clear history
MajixEmail.clearHistory();
```

---

## Callbacks

```js
MajixEmail.init({
  provider: 'formsubmit',
  toEmail:  'you@example.com',
  onSend:  function (env) { console.log('Sent to', env.to); },
  onError: function (err) { alert('Failed: ' + err.message); },
});
```

---

## EmailJS example

```js
// 1. Load the SDK in your HTML:
//    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>

window.EMAIL_CONFIG = {
  provider:   'emailjs',
  serviceId:  'service_xxxxxxx',
  templateId: 'template_xxxxxxx',
  publicKey:  'your_public_key',
};
MajixEmail.init();

MajixEmail.send({
  to:      'alice@example.com',
  from:    'sender@example.com',
  subject: 'Hello',
  body:    'This was sent via EmailJS!',
});
```

---

## FormSubmit example

```js
window.EMAIL_CONFIG = {
  provider: 'formsubmit',
  toEmail:  'you@example.com',   // must be verified with FormSubmit first
};
MajixEmail.init();

MajixEmail.send({
  from:    'visitor@example.com',
  subject: 'Contact form submission',
  body:    'Hello, I have a question…',
});
```
