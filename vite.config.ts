import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
