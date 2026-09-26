import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Playwright fixtures name their callback `use`, which this rule mistakes for React.use()
    files: ["tests/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // plain Node scripts and the static Checkpoint 1 page are not part of the app
    "scripts/**",
    "public/checkpoint-1/**",
    "assets/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
