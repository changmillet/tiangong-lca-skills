import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = ['flow-governance-review', 'lifecycleinventory-review'];
const indexHash = 'd8f1e90777fe0c675d1e24cbd7f1141ee776d3ebda9d8b24c91f714779540dec';
const flowIds = [
  'tidas.flow.classification.elementary.valid',
  'tidas.flow.flow-property.mean-value.positive',
  'tidas.flow.name.base-name.technical',
  'tidas.flow.reference-property-unit.required',
  'tidas.flow.type.required',
];
const processIds = [
  'tidas.process.name.base-name.align-reference-flow',
  'tidas.process.name.qualifiers.structured',
];

function readRule(cwd, args = []) {
  return spawnSync(process.execPath, ['scripts/read-public-rule.mjs', ...args], {
    cwd, encoding: 'utf8',
  });
}

test('both independently distributed skills bind the exact published public-rule index', () => {
  const copies = packages.map((name) => {
    const dir = path.join(root, name);
    const bytes = readFileSync(path.join(dir, 'assets/tidas-public-rules/public-rules.v1.json'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), indexHash);
    const result = readRule(dir);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.source.version, '0.2.1');
    assert.equal(payload.source.rules_version, '2026.09.20');
    assert.equal(payload.rules.rules.length, 9);
    return { bytes, script: readFileSync(path.join(dir, 'scripts/read-public-rule.mjs')) };
  });
  assert.deepEqual(copies[0].bytes, copies[1].bytes);
  assert.deepEqual(copies[0].script, copies[1].script);
  const flow = readFileSync(path.join(root, 'flow-governance-review/references/tidas_flows.yaml'), 'utf8');
  for (const id of flowIds) assert.ok(flow.includes(`public_rule_id: "${id}"`));
  const process = readFileSync(path.join(root, 'lifecycleinventory-review/profiles/process/references/process-review-rules.md'), 'utf8');
  for (const id of processIds) assert.ok(process.includes(`--rule-id ${id}`));
});

test('copied skill package and explicit rule overrides fail closed on incompatible identity or bytes', (t) => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'skills-public-rules-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  for (const name of packages) {
    const dir = path.join(temp, name);
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    cpSync(path.join(root, name, 'scripts/read-public-rule.mjs'), path.join(dir, 'scripts/read-public-rule.mjs'), { recursive: true });
    cpSync(path.join(root, name, 'assets/tidas-public-rules'), path.join(dir, 'assets/tidas-public-rules'), { recursive: true });
    const id = name === packages[0] ? flowIds[0] : processIds[0];
    const valid = readRule(dir, ['--rule-id', id]);
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).rules.id, id);
    const assets = path.join(dir, 'assets/tidas-public-rules');
    assert.equal(readRule(dir, ['--rules-dir', assets, '--rule-id', id]).status, 0);
    const sourcePath = path.join(assets, 'public-rules.source.json');
    const originalSource = readFileSync(sourcePath, 'utf8');
    writeFileSync(sourcePath, originalSource.replace('0.2.1', '0.2.0'));
    assert.notEqual(readRule(dir, ['--rules-dir', assets, '--rule-id', id]).status, 0);
    writeFileSync(sourcePath, originalSource);
    const indexPath = path.join(assets, 'public-rules.v1.json');
    const originalIndex = readFileSync(indexPath);
    writeFileSync(indexPath, Buffer.concat([originalIndex, Buffer.from(' ')]));
    assert.notEqual(readRule(dir, ['--rule-id', id]).status, 0);
  }
});
