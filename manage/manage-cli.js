#!/usr/bin/env node
/**
 * manage-cli.js  —  README Processing CLI for majixai.github.io
 *
 * Scans directories, reads README files, and updates marker-delimited sections.
 *
 * Usage:
 *   node manage/manage-cli.js [command] [options]
 *
 * Commands:
 *   list   [dir]                List all sections in a README
 *   get    [dir] --section NAME  Print content of a section
 *   set    [dir] --section NAME --content TEXT  Replace section content
 *   add    [dir] --section NAME --content TEXT [--position N|start|end]
 *   remove [dir] --section NAME  Remove a section
 *   scan   [root] [--pattern glob]  Scan for READMEs and list their sections
 *   render [dir] [--out file]     Convert README to HTML
 *   stats  [root]                 Print README stats across all directories
 *
 * Examples:
 *   node manage/manage-cli.js list .
 *   node manage/manage-cli.js get  . --section REPO_STATS
 *   node manage/manage-cli.js set  . --section LAST_UPDATED --content "2026-01-01"
 *   node manage/manage-cli.js scan . --pattern STAR/README.md
 *   node manage/manage-cli.js render pagination --out /tmp/pagination.html
 *   node manage/manage-cli.js stats .
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Marker helpers ───────────────────────────────────────────────────────────

const START_RE = /<!--\s*START_([A-Z0-9_]+)\s*-->/gi;

function makeStart(name) { return `<!-- START_${name} -->`; }
function makeEnd(name)   { return `<!-- END_${name} -->`; }

function sectionRe(name) {
  const e = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(<!--\\s*START_${e}\\s*-->)[\\s\\S]*?(<!--\\s*END_${e}\\s*-->)`,
    'gi'
  );
}

function parseSections(markdown) {
  const map = new Map();
  const startRe = /<!--\s*START_([A-Z0-9_]+)\s*-->/gi;
  let m;
  while ((m = startRe.exec(markdown)) !== null) {
    const name    = m[1].toUpperCase();
    const end     = `<!-- END_${name} -->`;
    const endIdx  = markdown.indexOf(end, m.index + m[0].length);
    if (endIdx === -1) continue;
    const content = markdown.slice(m.index + m[0].length, endIdx).replace(/^\n/, '').replace(/\n$/, '');
    map.set(name, { content, startIdx: m.index, endIdx: endIdx + end.length });
  }
  return map;
}

// ── Minimal MD → HTML (mirrors browser implementation) ───────────────────────

function mdToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm,    '<h1>$1</h1>');
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const lc = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${lc}>${escHtml(code.trim())}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
  html = buildLists(html);
  html = html.replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p>$1</p>');
  return html;
}

function buildLists(html) {
  html = html.replace(/((?:^[-*+]\s+.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*+]\s+/, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  return html;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── File helpers ─────────────────────────────────────────────────────────────

function readmeFor(dir) {
  const p = path.resolve(dir, 'README.md');
  if (!fs.existsSync(p)) {
    die(`No README.md found in ${path.resolve(dir)}`);
  }
  return p;
}

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, content) { fs.writeFileSync(p, content, 'utf8'); }

// ── Glob-lite: find files matching a simple pattern (*/README.md, **/*.md) ───

function findFiles(root, pattern) {
  const results = [];
  const patternParts = pattern.split('/');
  const isDeep = patternParts[0] === '**';

  function walk(dir, depth) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        if (isDeep || patternParts[0] === '*') walk(full, depth + 1);
      } else if (e.isFile()) {
        const relFromRoot = path.relative(root, full).replace(/\\/g, '/');
        if (matchGlob(pattern, relFromRoot)) results.push(full);
      }
    }
  }

  walk(root, 0);
  return results;
}

function matchGlob(pattern, filePath) {
  // Convert glob to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]+')
    .replace(/__DOUBLESTAR__/g, '.*');
  return new RegExp('^' + regexStr + '$').test(filePath);
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdList(dir) {
  const p = readmeFor(dir);
  const sections = parseSections(readFile(p));
  if (sections.size === 0) {
    console.log('No marker sections found in', p);
    return;
  }
  console.log(`Sections in ${p}:`);
  for (const [name, { content }] of sections) {
    const preview = content.slice(0, 60).replace(/\n/g, ' ');
    console.log(`  • ${name.padEnd(30)} (${content.length} chars)  ${preview}…`);
  }
}

function cmdGet(dir, sectionName) {
  const p = readmeFor(dir);
  const sections = parseSections(readFile(p));
  const key = sectionName.toUpperCase();
  const sec = sections.get(key);
  if (!sec) {
    die(`Section "${key}" not found in ${p}`);
  }
  process.stdout.write(sec.content + '\n');
}

function cmdSet(dir, sectionName, content) {
  const p = readmeFor(dir);
  let src = readFile(p);
  const key = sectionName.toUpperCase();
  const sections = parseSections(src);
  const re = sectionRe(key);
  const replacement = `${makeStart(key)}\n${content}\n${makeEnd(key)}`;

  if (sections.has(key)) {
    src = src.replace(re, replacement);
  } else {
    src += `\n${replacement}\n`;
  }

  writeFile(p, src);
  console.log(`Updated section "${key}" in ${p}`);
}

function cmdAdd(dir, sectionName, content, position) {
  const p = readmeFor(dir);
  let src = readFile(p);
  const key = sectionName.toUpperCase();
  const sections = parseSections(src);

  if (sections.has(key)) {
    console.warn(`Section "${key}" already exists; updating instead.`);
    return cmdSet(dir, key, content);
  }

  const block = `${makeStart(key)}\n${content || ''}\n${makeEnd(key)}`;
  const lines = src.split('\n');

  if (position === 'start') {
    lines.unshift(block);
  } else if (!isNaN(parseInt(position, 10))) {
    lines.splice(Math.max(0, parseInt(position, 10)), 0, block);
  } else {
    lines.push(block);
  }

  src = lines.join('\n');
  writeFile(p, src);
  console.log(`Added section "${key}" to ${p}`);
}

function cmdRemove(dir, sectionName) {
  const p = readmeFor(dir);
  let src = readFile(p);
  const key = sectionName.toUpperCase();
  const sections = parseSections(src);
  if (!sections.has(key)) {
    die(`Section "${key}" not found in ${p}`);
  }
  src = src.replace(sectionRe(key), '').replace(/\n{3,}/g, '\n\n');
  writeFile(p, src);
  console.log(`Removed section "${key}" from ${p}`);
}

function cmdScan(root, pattern) {
  const pat  = pattern || '*/README.md';
  const files = findFiles(path.resolve(root), pat);
  let total = 0;

  if (files.length === 0) {
    console.log(`No files matching "${pat}" found under ${path.resolve(root)}`);
    return;
  }

  for (const file of files) {
    const src = readFile(file);
    const sections = parseSections(src);
    const rel = path.relative(path.resolve(root), file);
    console.log(`\n📄 ${rel}  (${sections.size} section${sections.size !== 1 ? 's' : ''})`);
    for (const [name] of sections) {
      console.log(`   • ${name}`);
      total++;
    }
  }
  console.log(`\nTotal: ${files.length} README(s), ${total} section(s)`);
}

function cmdRender(dir, outFile) {
  const p = readmeFor(dir);
  const src = readFile(p);
  const body = mdToHtml(src);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${path.basename(path.resolve(dir))} — README</title>
  <link rel="stylesheet" href="/manage/manage.css">
  <style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:860px;margin:0 auto}</style>
</head>
<body class="mgr-doc">${body}</body>
</html>`;
  if (outFile) {
    writeFile(outFile, html);
    console.log(`Rendered HTML written to ${outFile}`);
  } else {
    process.stdout.write(html);
  }
}

function cmdStats(root) {
  const files = findFiles(path.resolve(root), '*/README.md');
  // also check root README
  const rootReadme = path.join(path.resolve(root), 'README.md');
  const allFiles = fs.existsSync(rootReadme) ? [rootReadme, ...files] : files;

  let totalSections = 0;
  let withSections  = 0;
  let withoutSections = 0;
  const topSections = new Map();

  for (const file of allFiles) {
    const src = readFile(file);
    const sections = parseSections(src);
    if (sections.size > 0) {
      withSections++;
      totalSections += sections.size;
      for (const name of sections.keys()) {
        topSections.set(name, (topSections.get(name) || 0) + 1);
      }
    } else {
      withoutSections++;
    }
  }

  console.log('\n─── README Stats ──────────────────────────────');
  console.log(`  README files scanned : ${allFiles.length}`);
  console.log(`  With marker sections : ${withSections}`);
  console.log(`  Without sections     : ${withoutSections}`);
  console.log(`  Total sections       : ${totalSections}`);

  if (topSections.size > 0) {
    const sorted = [...topSections.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('\n  Most common section names:');
    for (const [name, count] of sorted) {
      console.log(`    ${String(count).padStart(3)}×  ${name}`);
    }
  }
  console.log('─────────────────────────────────────────────\n');
}

// ── Argument parser ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args   = argv.slice(2);
  const cmd    = args[0];
  const opts   = {};
  const pos    = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    } else {
      pos.push(args[i]);
    }
  }
  return { cmd, pos, opts };
}

function die(msg) { console.error('Error:', msg); process.exit(1); }

function help() {
  console.log(`
manage-cli.js — README Processing CLI

Usage:
  node manage/manage-cli.js <command> [dir] [options]

Commands:
  list   [dir]                         List all sections in README.md
  get    [dir] --section NAME          Print a section's content
  set    [dir] --section NAME \\
               --content TEXT          Replace a section
  add    [dir] --section NAME \\
               --content TEXT \\
               [--position N|start|end] Add a new section
  remove [dir] --section NAME          Remove a section
  scan   [root] [--pattern GLOB]       Scan dirs for READMEs and list sections
  render [dir]  [--out FILE]           Convert README.md to HTML
  stats  [root]                        Print README stats across directories

Options:
  --section NAME    Section name (case-insensitive; stored UPPERCASE)
  --content TEXT    New section content (use \\n for newlines)
  --position        Insertion position: line number, "start", or "end" (default)
  --pattern GLOB    Glob for scan (default: "*/README.md")
  --out FILE        Output file for render command

Examples:
  node manage/manage-cli.js list .
  node manage/manage-cli.js get  pagination --section QUICK_START
  node manage/manage-cli.js set  . --section LAST_UPDATED --content "2026-01-01"
  node manage/manage-cli.js scan . --pattern "*/README.md"
  node manage/manage-cli.js render pagination --out /tmp/out.html
  node manage/manage-cli.js stats .
`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(function main() {
  const { cmd, pos, opts } = parseArgs(process.argv);
  const dir  = pos[0] || '.';

  switch (cmd) {
    case 'list':
      cmdList(dir);
      break;

    case 'get':
      if (!opts.section) die('--section is required');
      cmdGet(dir, opts.section);
      break;

    case 'set':
      if (!opts.section) die('--section is required');
      if (opts.content === undefined) die('--content is required');
      cmdSet(dir, opts.section, String(opts.content).replace(/\\n/g, '\n'));
      break;

    case 'add':
      if (!opts.section) die('--section is required');
      cmdAdd(dir, opts.section, String(opts.content || '').replace(/\\n/g, '\n'), opts.position || 'end');
      break;

    case 'remove':
      if (!opts.section) die('--section is required');
      cmdRemove(dir, opts.section);
      break;

    case 'scan':
      cmdScan(dir, opts.pattern);
      break;

    case 'render':
      cmdRender(dir, opts.out || null);
      break;

    case 'stats':
      cmdStats(dir);
      break;

    case undefined:
    case 'help':
    case '--help':
    case '-h':
      help();
      break;

    default:
      console.error(`Unknown command: "${cmd}"`);
      help();
      process.exit(1);
  }
}());
