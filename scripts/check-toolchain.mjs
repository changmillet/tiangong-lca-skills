#!/usr/bin/env node
import {
  assertSupportedToolchain,
  buildTiangongInvocation,
  expectedNodeVersion,
  expectedPnpmVersion,
} from './lib/cli-launcher.mjs';
import process from 'node:process';

let cliDir = null;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--cli-dir') {
    if (index + 1 >= args.length) {
      throw new Error('--cli-dir requires a value');
    }
    cliDir = args[index + 1];
    index += 1;
    continue;
  }
  if (arg.startsWith('--cli-dir=')) {
    cliDir = arg.slice('--cli-dir='.length);
    continue;
  }
  throw new Error(`Unknown toolchain check option: ${arg}`);
}

assertSupportedToolchain();
console.log(`Validated Node ${expectedNodeVersion} and pnpm ${expectedPnpmVersion}.`);

if (cliDir !== null) {
  const invocation = buildTiangongInvocation([], { cliDir });
  if (invocation.mode !== 'local') {
    throw new Error('--cli-dir must identify a non-empty local TianGong CLI path.');
  }
  console.log(
    `Validated explicit local ${invocation.packageVersion} package, frozen lock, and source-bound TIDAS manifest evidence at ${invocation.cliDir}.`,
  );
}
