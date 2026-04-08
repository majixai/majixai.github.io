#!/usr/bin/env node
// pwa/hash-assets.js — Generate SHA-256 integrity hashes for SW_CONFIG
//
// Computes the 'sha256-<base64>' value for each file so you can pin it
// inside SW_CONFIG.integrity (or as appShellFiles object entries).
//
// Usage:
//   node pwa/hash-assets.js <file1> [file2] ...
//   node pwa/hash-assets.js --base ./myapp  script.js style.css manifest.json
//   node pwa/hash-assets.js --json ./options/script.js ./options/style.css
//
// Options:
//   --base <dir>   Resolve relative paths against <dir> instead of CWD.
//   --json         Print only the JSON integrity object (no progress output).
//
// Output example:
//   ./script.js  sha256-abc123...
//
//   // Paste into SW_CONFIG.integrity:
//   integrity: {
//     "./script.js": "sha256-abc123..."
//   }

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Parse CLI args ─────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
let baseDir   = process.cwd();
let jsonOnly  = false;
const files   = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i + 1]) {
    baseDir = path.resolve(args[++i]);
  } else if (args[i] === '--json') {
    jsonOnly = true;
  } else {
    files.push(args[i]);
  }
}

if (files.length === 0) {
  process.stderr.write(
    'Usage: node pwa/hash-assets.js [--base <dir>] [--json] <file1> [file2] ...\n' +
    '\n' +
    'Examples:\n' +
    '  node pwa/hash-assets.js ./options/script.js ./options/style.css\n' +
    '  node pwa/hash-assets.js --base ./options  script.js style.css manifest.json\n' +
    '  node pwa/hash-assets.js --json ./sw.js\n'
  );
  process.exit(1);
}

// ── Hash each file ─────────────────────────────────────────────────────────

const result   = {};
let   hasError = false;

for (const file of files) {
  const absPath = path.isAbsolute(file) ? file : path.resolve(baseDir, file);

  try {
    const content = fs.readFileSync(absPath);
    const hash    = crypto.createHash('sha256').update(content).digest('base64');
    const key     = file.startsWith('./') ? file : './' + path.relative(baseDir, absPath);
    const value   = `sha256-${hash}`;

    result[key] = value;
    if (!jsonOnly) process.stdout.write(`  ${key.padEnd(40)}  ${value}\n`);
  } catch (err) {
    process.stderr.write(`ERROR: cannot hash "${file}": ${err.message}\n`);
    hasError = true;
  }
}

// ── Output ─────────────────────────────────────────────────────────────────

const json = JSON.stringify(result, null, 2);

if (jsonOnly) {
  process.stdout.write(json + '\n');
} else {
  process.stdout.write('\n// Paste into SW_CONFIG.integrity:\nintegrity: ' + json + '\n');
}

process.exit(hasError ? 1 : 0);
