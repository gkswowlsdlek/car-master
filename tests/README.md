# Regression test guide

`pnpm test` uses Node's built-in test runner and discovers every `*.test.mjs` file in this directory through a quoted, cross-platform glob.
New regression files therefore do not require a separate `package.json` script edit.

- Prefer behavioral tests that import and execute product functions.
- Keep source-contract tests only where local execution is impractical, such as SQL migrations, RLS/RPC grants, and framework wiring.
- Contract tests should normalize line endings and assert the smallest meaningful contract instead of indentation or large copied source blocks.
- Do not reproduce product logic inside a test and then test only the reproduction.
- `pnpm run test:production-smoke` remains the production-server HTTP boundary test and requires a fresh `pnpm build` first.
