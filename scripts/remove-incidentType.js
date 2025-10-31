#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findFiles(dir, name, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // skip node_modules and .git
      if (e.name === 'node_modules' || e.name === '.git') continue;
      findFiles(full, name, results);
    } else if (e.isFile() && e.name === name) {
      results.push(full);
    }
  }
  return results;
}

function backupFile(file) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${file}.bak.${ts}`;
  fs.copyFileSync(file, bak);
  return bak;
}

function processFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    console.error('Failed to read', file, err.message);
    return { file, ok: false, reason: 'read' };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Invalid JSON in', file);
    return { file, ok: false, reason: 'invalid-json' };
  }

  if (!Array.isArray(data)) {
    console.log('Skipping non-array file', file);
    return { file, ok: true, skipped: true };
  }

  const anyHad = data.some(r => r && Object.prototype.hasOwnProperty.call(r, 'incidentType'));
  if (!anyHad) {
    console.log('No incidentType found in', file);
    return { file, ok: true, changed: false };
  }

  const bak = backupFile(file);
  const cleaned = data.map(r => {
    if (!r || typeof r !== 'object') return r;
    const copy = { ...r };
    if (Object.prototype.hasOwnProperty.call(copy, 'incidentType')) delete copy.incidentType;
    return copy;
  });

  try {
    fs.writeFileSync(file, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log('Updated', file, 'backup at', bak);
    return { file, ok: true, changed: true, backup: bak };
  } catch (err) {
    console.error('Failed to write', file, err.message);
    return { file, ok: false, reason: 'write' };
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  console.log('Searching for records.json under', repoRoot);
  const files = findFiles(repoRoot, 'records.json');
  if (!files.length) {
    console.log('No records.json files found. Exiting.');
    return;
  }
  const results = files.map(processFile);
  console.log('\nSummary:');
  for (const r of results) console.log(r.file, '->', r.ok ? (r.changed ? 'updated' : (r.skipped ? 'skipped' : 'no-change')) : `ERROR(${r.reason})`);
}

main();
