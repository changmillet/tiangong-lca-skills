# Env (caller side)

- CLI path override: `TIANGONG_LCA_CLI_DIR`
- Default CLI runtime: the exact package pinned by `scripts/lib/cli-launcher.mjs`
- OAuth client variable: `TIANGONG_LCA_OAUTH_CLIENT_ID`
- Supabase public-key variable: `TIANGONG_LCA_SUPABASE_PUBLISHABLE_KEY`
- Base URL variable: `TIANGONG_LCA_API_BASE_URL`
- Default endpoint remains `https://qgzvkongdjqiiamzbbts.supabase.co/functions/v1/embedding_ft`

Wrapper behavior:

- the Node `.mjs` wrapper uses the configured CLI and injects the example `--input` file when none is provided
- set `TIANGONG_LCA_CLI_DIR` or pass `--cli-dir` only when you need a local CLI working tree
- all other flags are the standard `tiangong-lca admin embedding-run` flags
- internally it forwards to `tiangong-lca admin embedding-run`
- run `tiangong-lca auth doctor-auth --json` before queue mutation
- use a separate private `TIANGONG_LCA_SESSION_FILE` for each account/project/client context
- headless automation may receive only a short-lived `TIANGONG_LCA_ACCESS_TOKEN` from an approved orchestrator secret path
- never request, decode, print, or forward `TIANGONG_LCA_API_KEY`, a password, authorization code, access token, or refresh token
