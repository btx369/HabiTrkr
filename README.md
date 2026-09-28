# HabiTrkr

A private, offline-first habit, notes and events tracker. All data lives in the
device's `localStorage` — there is no backend, no account, and no network call.

## Tech stack

| Concern | Choice |
|---|---|
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix) |
| Routing | React Router 6 |
| Dates | date-fns 4 |
| Native shell | Capacitor 8 (Android / iOS) |
| Package manager | npm |

## Getting started

```sh
npm install
npm run dev        # http://localhost:8080
```

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with hot reload on port 8080 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the whole project |
| `npm run typecheck` | TypeScript check with no emit |
| `npm run cap:sync` | Build the web app and sync it into native projects |
| `npm run cap:android` | Build, sync, and open the Android project |

## Native builds (Capacitor)

The native app loads the web assets bundled into `dist/` — it does **not** point at
any external URL, so it works fully offline.

```sh
npm run build
npx cap add android      # first time only; the android/ project is already committed
npm run cap:sync         # after every web change
npm run cap:android      # build, sync and open the Android project
```

### Prerequisites for the Android build

1. **JDK 21** — Gradle needs it and Capacitor requires `JAVA_HOME` to be set:

   ```sh
   winget install --id Microsoft.OpenJDK.21
   setx JAVA_HOME "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
   ```

   (`setx` applies to new shells; export it in the current one as well.)

2. **Android SDK** with API 36 and build-tools 36.x, plus `ANDROID_HOME` pointing at it.
   The SDK Manager is easiest to get from Android Studio, or via
   `winget install --id Google.AndroidStudio`.

3. **SDK location for Gradle** — create `android/local.properties` (gitignored, so it is
   per-machine). Note the escaped backslashes Gradle requires:

   ```properties
   sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
   ```

Then build a debug APK directly:

```sh
cd android
gradlew.bat assembleDebug      # Windows
./gradlew assembleDebug        # macOS / Linux
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

### Running the dev server alongside Capacitor

`vite.config.ts` excludes `android/`, `ios/` and `dist/` from the file watcher. Without
that, `npx cap sync` rewriting `android/app/src/main/assets/public` (and Gradle holding
locks under `android/app/build`) makes the dev server exit with `EBUSY: resource busy or
locked`. Keep those entries in place.

## Project layout

```
resources/
  icon-source.jpg   master artwork for scripts/generate-icons.mjs
  icon.png          generated 1024px app icon
scripts/
  generate-icons.mjs        regenerates every web/PWA/Android icon
  verify-date-utils.mjs     proves the local-date helpers
  verify-date-migration.mjs exercises the date-key repair tool
  verify-icons.mjs          checks icon wiring in a real browser
  audit-responsive.mjs      screenshots every route at phone/tablet/desktop
  lib/demo-data.mjs         seeded data used by the responsive audit
src/
  components/
    calendar/   calendar day view and event items
    events/     event cards, editor, viewer, folders
    habits/     habit cards, editor, folders
    noteFolders/
    notes/      note cards, editors, viewers, capture flows
    shared/     cross-feature components (dialogs, bulk bar, tags, audio)
    ui/         shadcn/ui primitives
  contexts/     theme, language, toast, week-start providers
  hooks/        reusable hooks (local storage, bulk selection, swipe)
  lib/          date helpers, migrations, tag storage, notifications
  pages/        route-level screens (lazy-loaded except the start route)
  types/        shared domain types
```

## Icons

All icons come from one source image:

```sh
node scripts/generate-icons.mjs            # uses resources/icon-source.jpg
node scripts/generate-icons.mjs other.jpg  # or an explicit source
```

It renders with headless Chrome via a canvas, so there is no image library to install.
It writes the browser favicons, the PWA icons and manifest targets, every Android
launcher/round/adaptive-icon density, and the Android splash screens — straight into
`public/` and `android/app/src/main/res/`, so no `cap sync` is needed afterwards.

Two things to know if you swap the artwork:

- The source is cropped with `CROP` in the script. Re-measure it if the new image has
  different padding, otherwise the icon will be off-centre or clipped.
- `BACKGROUND_COLOR` is the solid colour behind the Android adaptive foreground. Set it
  to match the new artwork's own edge colour so the mask transition is invisible.

Verify the wiring end to end (with the dev server running):

```sh
node scripts/verify-icons.mjs
```

## Responsive layout

The app targets the same three tiers as before, all driven by Tailwind's breakpoints:

| Tier | Width | Card grids |
|---|---|---|
| Phone | `< 768px` | 1 column |
| Tablet | `768px – 1023px` | 2 columns |
| Desktop / browser | `>= 1024px` | 3 columns |

Lists (`Notes`, `Events`) render either a list or the grid depending on the saved view
setting in each page's view-settings menu; the grid columns follow the table above.

To check a change at every size, with realistic data seeded into `localStorage`:

```sh
node scripts/audit-responsive.mjs                 # every route x every width
node scripts/audit-responsive.mjs /notes tablet   # one route, one width
node scripts/audit-responsive.mjs --dark          # dark theme
```

Screenshots land in `.screenshots/` (gitignored). The script also reports horizontal
overflow per page, which is the fastest way to catch a layout regression.

It drives Chrome over the DevTools Protocol rather than using `--screenshot`, for two
reasons: `localStorage` has to be seeded (otherwise you are only ever auditing the
empty state), and `--window-size` sets the *window* rather than the *viewport*, which
can make a page lay out wider than requested and look broken when it is not.

## Domain notes

### Habit tracking modes

A habit tracks in one of three modes:

- **Basic** — mark done once per day.
- **Number of days** — a weekly goal (`numberOfDaysPerWeek`), optionally with a
  per-day target (`timesPerDay`).
- **Unlimited times** — no daily or weekly ceiling.

Completion counts are **never** deleted when the mode changes; only the
interpretation changes (whether a day counts as complete). Undo applies to today
only.

### Storage keys

`src/lib/storageKeys.ts` is the single source of truth for every `localStorage` key.
Keys are per-origin and per-browser-profile, so each device keeps its own copy — and a
key that is renamed without a migration becomes an address the app never reads again.

Two rules:

- App-owned settings are prefixed with `habitrkr.` (theme, language, week start, profile).
- Data collections keep plain names (`habits`, `notes`, `events`, …) because users
  address them through Profile → Export/Import.

**Renaming a key:** add the old name to `RENAMED_KEYS` in `storageKeys.ts`.
`src/lib/storageMigration.ts` runs at startup, copies any value found under an old name
to the new one, and removes the old key — but only when the new key is empty, so it is
idempotent and never clobbers a live value. Do not pass a literal `storageKey` prop to
`ThemeProvider`; that silently reintroduces an old name and orphans whatever the
migration moved.

### Date keys

Every "which day is this?" decision goes through `src/lib/dateUtils.ts`. Date keys
are `yyyy-MM-dd` in **local** time.

> Do not use `toISOString()` to build a date key — it returns the **UTC** day, which
> disagrees with the local day for part of every day outside UTC. This was a real bug
> (completions filed on the wrong day), now fixed at every call site.

#### Existing data written by the old buggy code

`src/lib/dateMigration.ts` can repair completions that the old code filed a day early,
but it is **deliberately not automatic**. A stored UTC key and a stored local key are
indistinguishable by value (`2026-01-09` could legitimately be either), so any blanket
rewrite has to guess a shift direction and would guess wrong for roughly half the
world's timezones. Guessing would corrupt data, so the repair is opt-in.

The affected window depends on the zone:

| Zone | Divergence window | Share of hours |
|---|---|---|
| UTC+0 (Lisbon, winter) | none | 0% |
| UTC+1 (Lisbon, summer) | 00:00–01:00 local | ~4% |
| UTC+9 (Tokyo) | 00:00–09:00 local | ~38% |

Inspect first, then repair a specific range from the browser console:

```js
import('/src/lib/dateMigration.ts').then((m) => {
  // Read-only: how many completions fall inside the window you care about?
  console.table(m.inspectHabitDateKeys('2026-04-01', '2026-10-31'));

  // Preview, then apply. Both are refused if the range was already repaired.
  m.repairHabitDateKeys('2026-04-01', '2026-10-31', { dryRun: true });
  m.repairHabitDateKeys('2026-04-01', '2026-10-31');
});
```

Repaired ranges are recorded so the same days can never be shifted twice.
`forgetRepairedRanges()` clears that record if you need to redo one.

`scripts/verify-date-utils.mjs` demonstrates the original bug and checks the helpers
across timezones; `scripts/verify-date-migration.mjs` exercises the repair tool
against a stubbed localStorage:

```sh
node scripts/verify-date-utils.mjs
node scripts/verify-date-migration.mjs
```

## Notes for contributors

- The app is offline-only by design. Avoid adding network dependencies.
- `npm run typecheck` and `npm run build` should both pass before committing.
