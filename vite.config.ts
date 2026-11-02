import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// GitHub Pages serves the site from /HabiTrkr/, so that build (and only that one)
// gets a base path and a CSP meta tag; Pages cannot send headers, unlike _headers on
// Netlify/Cloudflare. The Android build keeps "/" and no meta CSP, since Capacitor
// injects its bridge script into the page.
const githubPages = process.env.GITHUB_PAGES === "true";

const PAGES_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

export default defineConfig({
  base: githubPages ? "/HabiTrkr/" : "/",
  server: {
    port: 8080,
    watch: {
      // Never walk the native projects or generated output. Capacitor rewrites
      // android/app/src/main/assets/public on every `cap sync`, and Gradle keeps
      // locks under android/app/build — watching either makes the dev server die
      // with EBUSY on Windows and triggers pointless HMR reloads.
      //
      // The .tmpdir / .tmp patterns cover transient working directories that tooling
      // (and command wrappers) create inside the project; a locked one of those also
      // takes the dev server down with EBUSY.
      ignored: [
        "**/android/**",
        "**/ios/**",
        "**/dist/**",
        "**/.git/**",
        "**/*.tmpdir/**",
        "**/*.tmp",
        // Anything that hosts a Chrome profile must never be watched: the browser
        // keeps locked cache files there and the watcher dies with EBUSY on Windows.
        "**/.screenshots/**",
        "**/GPUPersistentCache/**",
      ],
    },
  },
  plugins: [
    react(),
    githubPages && {
      name: "pages-csp",
      apply: "build" as const,
      transformIndexHtml: (html: string) =>
        html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${PAGES_CSP}" />`
        ),
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
