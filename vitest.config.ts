import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Node 25+ ships its own experimental localStorage, which shadows jsdom's. Switch it off
// for the test workers, but only where the running Node knows the flag (older Node would
// refuse to start with an unknown option).
const execArgv = process.allowedNodeEnvironmentFlags.has("--no-experimental-webstorage")
  ? ["--no-experimental-webstorage"]
  : [];

// Reuses the app's Vite config (the `@` alias in particular), with a browser-like
// environment so localStorage and FileReader exist in tests.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts"],
      poolOptions: { forks: { execArgv }, threads: { execArgv } },
    },
  })
);
