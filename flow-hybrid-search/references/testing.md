# Testing

First configure the installed CLI entry described in `SKILL.md`. Run from the independently installed skill directory; no CLI or Data Foundry source checkout or custom Production profile is needed.

## Dry run (no login or network request)

```bash
node scripts/run-flow-hybrid-search.mjs --dry-run --json
```

Confirm the CLI's Production endpoint and region in the planned request. This must not create a session. A custom `--base-url` without its matching complete configuration must fail before network access.

## Human login and read-only smoke

```bash
node scripts/run-cli.mjs auth status --json
```

After configuring the installed CLI entry described in `SKILL.md`, a fresh unauthenticated CLI reports `login-required` (exit 1). The human user then runs the configured CLI's `auth login` in a trusted terminal and completes browser consent. Never ask an agent to collect a password, code, or token. After login:

```bash
node scripts/run-cli.mjs auth doctor-auth --json
node scripts/run-flow-hybrid-search.mjs --json
```

## Direct CLI equivalent

```bash
node scripts/run-cli.mjs search flow --input ./assets/example-request.json --dry-run --json
```

Use `--cli-dir /path/to/tiangong-lca-cli` only for an explicitly selected matching local build. Custom environment setup is documented in `env.md`; it is not a Production prerequisite.

## Checklist

- A 200 response contains `data` (an array, possibly empty).
- A 400 response indicates a missing or invalid query.
- A 500 response indicates a provider/RPC failure; inspect service logs rather than changing the auth path.
- No credential or session content appears in output or test artifacts.
