#!/usr/bin/env node
// /java/java-runner.js  —  Node.js CLI helper for MajixAI Java processing
//
// Locates (or builds) the java-core fat JAR, then invokes it with the
// arguments you supply.  Works from any directory in the repository.
//
// Usage
// -----
//   node java/java-runner.js [--build] [appId] [dataDir] [outputFile]
//
// Options
//   --build   (re-)compile and package the JAR before running
//
// Examples
//   # Run with defaults (appId=majixai-app, dataDir=./data, outputFile=output.json)
//   node java/java-runner.js
//
//   # Run for a specific sub-project
//   node java/java-runner.js my-app ./my-app/data results.json
//
//   # Force a clean rebuild, then run
//   node java/java-runner.js --build my-app ./my-app/data results.json
//
// Requirements
//   • Java 17+ (java / javac on PATH, or JAVA_HOME set)
//   • Maven 3.8+  (mvn on PATH)  — only needed when --build is supplied
//     or the JAR does not yet exist.

'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Resolve repo root (directory that contains this script) ─────────────
const JAVA_DIR  = path.resolve(__dirname);
const REPO_ROOT = path.resolve(JAVA_DIR, '..');
const JAR_PATH  = path.join(JAVA_DIR, 'target', 'java-core.jar');

// ── Parse args ───────────────────────────────────────────────────────────
const rawArgs  = process.argv.slice(2);
const buildFlag = rawArgs.includes('--build');
const javaArgs  = rawArgs.filter(a => a !== '--build');

// ── Locate Java executable ───────────────────────────────────────────────
function javaExe() {
  const home = process.env.JAVA_HOME;
  if (home) {
    const bin = path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(bin)) return bin;
  }
  return 'java'; // assume java is on PATH
}

// ── Locate Maven executable ──────────────────────────────────────────────
function mvnExe() {
  return process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
}

// ── Build the JAR with Maven ─────────────────────────────────────────────
function buildJar() {
  console.log('[java-runner] Building java-core JAR…');
  const result = spawnSync(
    mvnExe(),
    ['-f', path.join(JAVA_DIR, 'pom.xml'), '-q', 'clean', 'package', '-DskipTests'],
    { stdio: 'inherit', cwd: REPO_ROOT }
  );
  if (result.status !== 0) {
    console.error('[java-runner] Maven build failed (exit ' + result.status + ')');
    process.exit(result.status ?? 1);
  }
  console.log('[java-runner] Build successful → ' + JAR_PATH);
}

// ── Main ─────────────────────────────────────────────────────────────────
(function main() {
  // Build if requested or if JAR is missing
  if (buildFlag || !fs.existsSync(JAR_PATH)) {
    buildJar();
  }

  if (!fs.existsSync(JAR_PATH)) {
    console.error('[java-runner] JAR not found after build: ' + JAR_PATH);
    process.exit(1);
  }

  // Construct java command
  const java   = javaExe();
  const cmdArgs = ['-jar', JAR_PATH, ...javaArgs];

  console.log('[java-runner] Running: ' + java + ' ' + cmdArgs.join(' '));

  const result = spawnSync(java, cmdArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  process.exit(result.status ?? 0);
})();
