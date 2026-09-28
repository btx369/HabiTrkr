/**
 * The app's localStorage key names, as plain JS.
 *
 * This deliberately MIRRORS `src/lib/storageKeys.ts`. The dev tooling runs in Node
 * under plain `node scripts/...` with no build step and no `@/` alias, so it cannot
 * import the TypeScript module directly.
 *
 * Keep the two files in step. If they drift, seeded audits silently write to keys the
 * app never reads — which looks exactly like a theme or data bug in the app.
 */

export const STORAGE_KEYS = {
  theme: 'habitrkr.theme',
  language: 'habitrkr.language',
  weekStart: 'habitrkr.weekStartDay',
  repairedDateRanges: 'habitrkr.repairedDateRanges',
  profileName: 'habitrkr.profileName',
  profileAvatar: 'habitrkr.profileAvatar',
};
