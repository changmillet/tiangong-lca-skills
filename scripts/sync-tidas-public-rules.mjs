#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = {
  package: '@tiangong-lca/tidas-spec',
  version: '0.2.1',
  commit: 'd4cb089c753ffd20b173db2e56fb553a364f48f4',
  archive_sha256: 'f11b29a1a06195704cd6e554cc96e25d04d518b4aa6de3be17d4ff886b48116c',
  rules_version: '2026.09.20',
  index_sha256: 'd8f1e90777fe0c675d1e24cbd7f1141ee776d3ebda9d8b24c91f714779540dec',
};
const packages = ['flow-governance-review', 'lifecycleinventory-review'];
const assetName = 'public-rules.v1.json';
const sourceName = 'public-rules.source.json';
const expectedSource = `${JSON.stringify(source, null, 2)}\n`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function sourceIndex(sourceRoot) {
  const commit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (commit !== source.commit) throw new Error(`Unexpected spec source commit: ${commit}`);
  const bytes = readFileSync(path.join(sourceRoot, 'assets/tidas/rules', assetName));
  if (sha256(bytes) !== source.index_sha256) throw new Error('Published spec public-rule index digest mismatch');
  const parsed = JSON.parse(bytes);
  if (parsed.rules_version !== source.rules_version || parsed.rules.length !== 9) {
    throw new Error('Published spec public-rule index shape/version mismatch');
  }
  return bytes;
}

function verifyPackage(packageName) {
  const assets = path.join(root, packageName, 'assets/tidas-public-rules');
  const bytes = readFileSync(path.join(assets, assetName));
  if (sha256(bytes) !== source.index_sha256) throw new Error(`${packageName}: index digest mismatch`);
  if (readFileSync(path.join(assets, sourceName), 'utf8') !== expectedSource) {
    throw new Error(`${packageName}: source identity mismatch`);
  }
  return bytes;
}

function main() {
  const args = process.argv.slice(2);
  const sourceRootIndex = args.indexOf('--source-root');
  if (args.length === 0) {
    const [first, second] = packages.map(verifyPackage);
    if (!first.equals(second)) throw new Error('Independent skill packages contain different public-rule bytes');
    console.log(`Verified two skill packages against ${source.package}@${source.version} (${source.index_sha256})`);
    return;
  }
  if (sourceRootIndex !== 0 || args.length !== 2) {
    throw new Error('Usage: node scripts/sync-tidas-public-rules.mjs [--source-root <exact-spec-checkout>]');
  }
  const bytes = sourceIndex(path.resolve(args[1]));
  for (const packageName of packages) {
    const assets = path.join(root, packageName, 'assets/tidas-public-rules');
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, assetName), bytes);
    writeFileSync(path.join(assets, sourceName), expectedSource);
  }
  console.log(`Copied exact released public-rule index into ${packages.join(' and ')}`);
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
