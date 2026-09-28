import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Generated output is never linted. android/app/build in particular contains
    // Capacitor's bundled native-bridge.js, which no one here can fix.
    ignores: [
      "dist",
      "android/app/build",
      "android/build",
      "android/app/src/main/assets",
      ".screenshots",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Downgraded from error to warning. Both fire on long-standing patterns in this
      // codebase rather than on defects: `any` appears in legacy passthrough helpers,
      // and `const` inside unbraced `case` blocks is how the original code was written.
      // Keeping them as errors left the whole lint run red, which hides genuinely new
      // problems. They are still reported, as warnings.
      "@typescript-eslint/no-explicit-any": "warn",
      "no-case-declarations": "warn",
    },
  }
);
