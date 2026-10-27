# Env (caller side)

Official Production uses the public profile bundled by the configured CLI; no `.env`, dashboard access, or separately supplied client ID is required. Skills do not copy Production URL/key/client values. The CLI resolves `/process_hybrid_search`; use `--dry-run` to inspect the planned endpoint without network access.

## Custom environments only

Configure one matching project tuple through the environment or a local `.env` file:

```text
TIANGONG_LCA_API_BASE_URL=https://<your-project>.supabase.co/functions/v1
TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY=<that-project-publishable-key>
TIANGONG_LCA_OAUTH_CLIENT_ID=<that-project-registered-public-client-id>
TIANGONG_LCA_OAUTH_REDIRECT_URI=http://127.0.0.1:49191/oauth/callback
```

The callback must be registered exactly. Partial custom settings and `--base-url` never inherit unrelated Production fields; known Production key/client values cannot target a foreign URL. Blank public settings and exact official URL aliases can use the CLI defaults. `TIANGONG_LCA_REGION` remains an optional region override.

## Wrapper and session behavior

- The individually installed skill bundles a byte-identical copy of `scripts/lib/cli-launcher.mjs`, the repository authority. It invokes the configured installed CLI and supplies the packaged example input when none is given.
- Source development is opt-in through `TIANGONG_LCA_CLI_DIR` or `--cli-dir`; no sibling checkout is discovered. Missing installed selection requires setup; there is no published-package fallback.
- Other flags are forwarded unchanged to `tiangong-lca search process`; the CLI owns authentication and refresh.
- Run `tiangong-lca auth status --json` before remote work. If `login-required`, a human runs `auth login` in a trusted terminal; use `auth doctor-auth --json` for live redacted verification.
- Use a separate private `TIANGONG_LCA_SESSION_FILE` per account/project/client context.
- Headless automation requires an explicit target URL/publishable key and `TIANGONG_LCA_AUTH_MODE=access-token`; only an approved orchestrator may inject a short-lived `TIANGONG_LCA_ACCESS_TOKEN`. A token alone never selects Production; it is verified online, not persisted, and not refreshed.
- Never request, decode, print, or forward passwords, authorization codes, access/refresh tokens, or legacy API keys in prompts, argv, logs, or artifacts.

Model and embedding providers are configured in the deployed Edge Function.
