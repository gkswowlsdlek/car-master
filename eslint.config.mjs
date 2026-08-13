import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Parallel git worktrees checked out alongside this repo (each is a
    // full copy of the source tree on another branch) — not part of this
    // branch's source, must never be linted from here.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
