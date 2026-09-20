#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const expected = {
  package: '@tiangong-lca/tidas-spec',
  version: '0.2.1',
  commit: 'd4cb089c753ffd20b173db2e56fb553a364f48f4',
  archive_sha256: 'f11b29a1a06195704cd6e554cc96e25d04d518b4aa6de3be17d4ff886b48116c',
  rules_version: '2026.09.20',
  index_sha256: 'd8f1e90777fe0c675d1e24cbd7f1141ee776d3ebda9d8b24c91f714779540dec',
};
const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/tidas-public-rules');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['-h', '--help'].includes(args[0])) {
    console.log('Usage: node scripts/read-public-rule.mjs [--rules-dir <dir>] [--rule-id <id>]');
    return;
  }
  let dir = defaultDir;
  let ruleId;
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--rules-dir' && args[i + 1]) dir = path.resolve(args[i + 1]);
    else if (args[i] === '--rule-id' && args[i + 1]) ruleId = args[i + 1];
    else throw new Error('Usage: node scripts/read-public-rule.mjs [--rules-dir <dir>] [--rule-id <id>]');
  }
  const source = JSON.parse(readFileSync(path.join(dir, 'public-rules.source.json'), 'utf8'));
  for (const [key, value] of Object.entries(expected)) {
    if (source[key] !== value) throw new Error(`Incompatible public-rule source identity: ${key}`);
  }
  const bytes = readFileSync(path.join(dir, 'public-rules.v1.json'));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== expected.index_sha256) throw new Error('Incompatible public-rule index digest');
  const index = JSON.parse(bytes);
  if (index.rules_version !== expected.rules_version || index.rules.length !== 9) {
    throw new Error('Incompatible public-rule index version or rule count');
  }
  const result = ruleId ? index.rules.find((rule) => rule.id === ruleId) : index;
  if (!result) throw new Error(`Public rule not covered: ${ruleId}`);
  console.log(JSON.stringify({ source, rules: result }, null, 2));
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
