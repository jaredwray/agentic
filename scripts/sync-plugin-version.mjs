#!/usr/bin/env node
// Keeps .claude-plugin/plugin.json `version` in sync with package.json after `changeset version`.
// Changesets bumps package.json; this propagates that version to the plugin manifest.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json');
const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));

if (plugin.version !== pkg.version) {
  plugin.version = pkg.version;
  writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);
  console.log(`Synced plugin.json version -> ${pkg.version}`);
} else {
  console.log(`plugin.json already at ${pkg.version}`);
}
