import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const entity of ['flow', 'process', 'lifecyclemodel']) {
  test(`independently installed ${entity} skill resolves Production without env or a checkout`, () => {
    const sandbox = mkdtempSync(path.join(tmpdir(), 'skills-installed-bootstrap-'));
    const name = `${entity}-hybrid-search`;
    const installed = path.join(sandbox, name);
    const sessionFile = path.join(sandbox, 'private-session', 'session.json');
    try {
      // Model a copied, individually installed skill, not a repository symlink.
      cpSync(path.join(repoRoot, name), installed, { recursive: true });
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(?:TIANGONG_|GIT_)/iu.test(key),
        ),
      );
      env.TIANGONG_LCA_SESSION_FILE = sessionFile;
      const run = (extra = [], overrides = {}) => spawnSync(
        process.execPath,
        [path.join(installed, 'scripts', `run-${name}.mjs`), '--dry-run', '--json', ...extra],
        { cwd: sandbox, env: { ...env, ...overrides }, encoding: 'utf8', shell: false, timeout: 60_000 },
      );
      const result = run();
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(JSON.parse(result.stdout).dryRun, true);
      const planned = JSON.parse(result.stdout).request;
      assert.equal(planned.url, `https://qgzvkongdjqiiamzbbts.supabase.co/functions/v1/${entity}_hybrid_search`);
      assert.equal(planned.headers['x-region'], 'us-east-1');
      assert.equal(existsSync(sessionFile), false, 'dry-run must not create an OAuth session');
      assert.equal(existsSync(path.join(sandbox, 'scripts')), false, 'no repository launcher is installed');
      assert.equal(
        readFileSync(path.join(installed, 'scripts', 'lib', 'cli-launcher.mjs'), 'utf8'),
        readFileSync(path.join(repoRoot, 'scripts', 'lib', 'cli-launcher.mjs'), 'utf8'),
        'bundled launcher must remain byte-identical to the one repository authority',
      );
      for (const library of ['cli-development.mjs', 'cli-installed.mjs']) {
        assert.equal(readFileSync(path.join(installed, 'scripts', 'lib', library), 'utf8'),
          readFileSync(path.join(repoRoot, 'scripts', 'lib', library), 'utf8'));
      }
      assert.equal(readFileSync(path.join(installed, 'scripts', 'run-cli.mjs'), 'utf8'),
        readFileSync(path.join(repoRoot, 'scripts', 'run-cli.mjs'), 'utf8'));
      const custom = run(['--base-url', 'https://custom.supabase.co']);
      assert.ifError(custom.error);
      assert.equal(custom.status, 2, custom.stderr || custom.stdout);
      assert.equal(existsSync(sessionFile), false);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
}
