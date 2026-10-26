import { spawnSync } from 'node:child_process';
import process from 'node:process';
import {
  normalizeCliRuntimeArgs as normalizeDevelopmentArgs,
  buildTiangongInvocation as buildDevelopmentInvocation,
  executeTiangongCommand as executeDevelopmentCommand,
  withCliRuntimeEnv as developmentRuntimeEnv,
  renderShellCommand,
} from './cli-development.mjs';
import { installedInvocation } from './cli-installed.mjs';

// Retain the explicit development and standalone-distribution contracts.
export {
  expectedNodeVersion, expectedPnpmVersion, expectedTidasSpecSource,
  publishedCliPackageSpec, publishedCliCommand, localCliCandidateSchema,
  assertSupportedToolchain, assertTidasSpecSourceManifest, inspectLocalCliCandidate,
  renderShellCommand,
} from './cli-development.mjs';

const installedFlags = new Map([
  ['--cli-installation', ['cliInstallation', 'TIANGONG_LCA_CLI_INSTALLATION']],
  ['--cli-runtime-expectation-file', ['cliRuntimeExpectationFile', 'TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_FILE']],
  ['--cli-runtime-expectation-sha256', ['cliRuntimeExpectationSha256', 'TIANGONG_LCA_CLI_RUNTIME_EXPECTATION_SHA256']],
]);

export function normalizeCliRuntimeArgs(rawArgs, options = {}) {
  const env = options.env ?? process.env;
  const filtered = [];
  const explicit = {};
  let selected = null;
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    const flag = arg.split('=', 1)[0];
    const installed = installedFlags.get(flag);
    if (installed) {
      const value = arg === flag ? rawArgs[++index] : arg.slice(flag.length + 1);
      if (!value?.trim() || value.startsWith('--')) throw new Error(`${flag} requires a value`);
      explicit[installed[0]] = value.trim();
      if (flag === '--cli-installation') selected = 'installed';
      continue;
    }
    if (flag === '--cli-dir') selected = 'development';
    if (arg === '--published-cli') selected = 'published';
    filtered.push(arg);
    if (flag === '--cli-dir' && arg === flag && index + 1 < rawArgs.length) {
      filtered.push(rawArgs[++index]);
    }
  }
  const installed = {};
  for (const [key, variable] of installedFlags.values()) {
    installed[key] = explicit[key] ?? env[variable]?.trim() ?? null;
  }
  const inherited = selected === null && env.TIANGONG_LCA_CLI_MODE !== 'published' &&
    Object.values(installed).some(Boolean);
  if (inherited && env.TIANGONG_LCA_CLI_DIR?.trim()) {
    throw new Error('Both installed and development CLI environments are configured. Select one explicitly; no implicit precedence or fallback is allowed.');
  }
  if (selected === 'installed' || inherited) {
    // An explicit installation cannot accidentally inherit another installation's qualification.
    if (explicit.cliInstallation && explicit.cliInstallation !== env.TIANGONG_LCA_CLI_INSTALLATION?.trim()) {
      installed.cliRuntimeExpectationFile = explicit.cliRuntimeExpectationFile ?? null;
      installed.cliRuntimeExpectationSha256 = explicit.cliRuntimeExpectationSha256 ?? null;
    }
    if (Object.values(installed).some((value) => !value)) {
      throw new Error('Installed CLI selection requires installation, runtime expectation file and independently trusted expectation SHA-256 together.');
    }
    // Strip development-only selection flags through their existing parser, but never execute it.
    const cleanEnv = { ...env, TIANGONG_LCA_CLI_MODE: 'published' };
    const development = normalizeDevelopmentArgs([...filtered, '--published-cli'], { ...options, env: cleanEnv });
    return { args: development.args, cliDir: null, cliCandidateFile: null, cliCandidateSha256: null,
      ...installed, cliSelectionSource: selected === 'installed' ? 'explicit' : 'environment' };
  }
  if (selected === null && Object.keys(explicit).length) {
    throw new Error('Runtime expectation flags require --cli-installation or an installed CLI environment.');
  }
  return normalizeDevelopmentArgs(filtered, options);
}

export function buildTiangongInvocation(args, options = {}) {
  return options.cliInstallation ? installedInvocation(args, options) : buildDevelopmentInvocation(args, options);
}

export function executeTiangongCommand(args, options = {}) {
  if (!options.cliInstallation) return executeDevelopmentCommand(args, options);
  const invocation = buildTiangongInvocation(args, options);
  const result = (options.spawnImpl ?? spawnSync)(invocation.command, invocation.args, {
    ...options.spawnOptions, stdio: 'pipe', encoding: 'utf8', shell: false,
  });
  if (result.error) throw new Error(`Failed to execute configured TianGong CLI: ${result.error.message}`);
  return { invocation, status: result.status, signal: result.signal,
    stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function runTiangongCommand(args, options = {}) {
  const result = executeTiangongCommand(args, options);
  if (result.stdout) (options.stdoutWrite ?? ((text) => process.stdout.write(text)))(result.stdout);
  if (result.stderr) (options.stderrWrite ?? ((text) => process.stderr.write(text)))(result.stderr);
  if (typeof result.status === 'number') return result.status;
  if (result.signal) throw new Error(`TianGong CLI terminated with signal ${result.signal}.`);
  return 1;
}

export function withCliRuntimeEnv(baseEnv, cliDir, options = {}) {
  const env = developmentRuntimeEnv(baseEnv, cliDir, options);
  for (const [, variable] of installedFlags.values()) delete env[variable];
  if (options.cliInstallation) {
    delete env.TIANGONG_LCA_CLI_MODE;
    delete env.TIANGONG_LCA_CLI_DIR;
    for (const [key, variable] of installedFlags.values()) env[variable] = options[key];
  }
  return env;
}

export function renderCliRuntimeHelp(rawArgs = process.argv.slice(2), options = {}) {
  const selected = normalizeCliRuntimeArgs(rawArgs, options);
  if (selected.cliInstallation) return `configured installation ${selected.cliInstallation} (${selected.cliSelectionSource}); inspect with scripts/run-cli.mjs --runtime-info`;
  if (selected.cliDir) return `explicit development checkout ${selected.cliDir}`;
  // Construction of the distribution command performs no install or invocation.
  const invocation = buildDevelopmentInvocation([], selected);
  return renderShellCommand(invocation.command, invocation.args);
}
