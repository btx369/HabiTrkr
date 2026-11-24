# HabiTrkr design system: "Calma Quente"

Product: a habit, notes, events and calendar app for busy adults. Feeling: **calm, warm, motivating, never stressful.**
Generated with the ui-ux-pro-max reference data (read as untrusted input, nothing executed from it except its local search script) and then adapted by hand: its suggested "Claymorphism" is too playful and heavy for a daily-use tool, so we keep only its warm amber and habit-green notes and soften everything else.

Source of truth in code: `src/index.css` (tokens, all HSL), `tailwind.config.ts` (names). Never hardcode colours; use tokens (`bg-leaf`, `text-sun`, `text-muted-foreground`...). User-chosen card colours stay as they are.

## 1. Style
Soft, warm, paper-like. Linen page with a faint sunrise glow, creamy cards, generous radius, wide low shadows tinted brown (never grey or black). Motion is gentle (150-300 ms ease-out) and respects `prefers-reduced-motion`. Progress is shown as growth (green), never as failure (no red for "missed").

## 2. Colour (light / dark)
| Role | Token | Light | Dark |
|---|---|---|---|
| Page (Linho) | `background` | #FBF6EF | #1A1614 |
| Card (Creme) | `card` | #FFFDFA | #28231F |
| Card inside colour surface | `item-card-surface` | #FFFDFA | #362F2B |
| Text (Cacau) | `foreground` | #3C2E2A | #F2ECE3 |
| Secondary text (Bruma) | `muted-foreground` | #665A52 | #B8ADA3 |
| Brand / primary (Musgo) | `leaf` = `primary` | #3B7257 | #6DBA94 |
| Warm accent: today, streaks (Sol) | `sun` | #E49125 | #F1AF4B |
| Destructive (Barro) | `destructive` | #AB4336 | #E57A6C |
| Muted surface | `muted` | #EEE7DD | #322D29 |
| Border / input | `border` / `input` | #E4DBCD / #CDBFAC | #413935 / #544B45 |
| Nav capsule | `nav` | #FEFBF6 | #362F2B |

Contrast: text on page 12:1, secondary text 6.2:1 (5.4:1 on muted), white on leaf 5.6:1, cocoa on sun 5.2:1, white on Barro 5.9:1.

**Chart colours** (`chart-1..5`, same order everywhere; never rely on colour alone, always add a label or value):
Musgo #3B7257 / #6DBA94, Sol #E49125 / #F1AF4B, Lago #41789F / #7BB0D5, Argila #C46345 / #E39178, Ameixa #8567A2 / #BDA2D7. Heatmaps and progress use leaf tints; "missed" is a neutral `muted` cell.

## 3. Typography (bundled locally, works offline)
- **Headings: Nunito** (variable, rounded, friendly). Titles only.
- **Body, numbers, stats and all small text: Atkinson Hyperlegible Next**, made by the Braille Institute for maximum character distinction (distinct 0/O, 1/l/I, slashed zero). It has tabular figures; `font-variant-numeric: tabular-nums` is set on `body`, so every date, counter, percentage and time aligns in columns.
- Rule: numbers never use the heading face. Minimum text size 11 px (counters, chart ticks), 12 px for anything read as a sentence, 16 px body inputs, line-height >= 1.4.
Scale: 11 / 12 / 14 / 16 / 20 / 24 (page titles) / 30 (stat numbers).

## 4. Spacing, radius, elevation
- 4 px base: 4, 8, 12, 16, 24, 32, 48, 64. Page gutter 8 px mobile; content is a centred column, max 768 px (`max-w-3xl`) on desktop.
- Radius: `--radius` 16 px (buttons, inputs, menus); cards 20 px; chips, tabs, switches and nav pills fully round.
- Elevation: one soft shadow, `--surface-shadow` (warm, 10/28 px, 28% alpha). Dialogs use an opaque `popover` surface over a 60% scrim.

## 5. Components
- **Primary button:** `bg-primary` (leaf), white label, pill or 16 px radius, min height 40 px, 44 px touch target on mobile. Secondary: outline on `border`, cocoa label. Destructive: Barro, used only in the confirm step.
- **Card:** `card` surface, 1 px `border`, 20 px radius, `--surface-shadow`, 12-16 px padding. Icon order left to right: folder, pin, bell, 3-dots at far right. Card icons 20 px; header/bar/button icons 24 px. No hover tooltips.
- **Tabs / segmented control:** round track, selected pill in leaf.
- **Done habit day:** filled leaf circle with a check; today: sun circle; missed: neutral outline (no red).
- **Calendar dots** (event / reminder / habit) sit below the day circle.
- **Floating nav capsule:** a light, small capsule in the light theme (card colour, soft border, 36 px buttons with 22 px icons), a raised dark one in the dark theme; active tab in leaf. The bulk-action bar shares its tokens. Digits 0-9 come from Nunito (`Plain Digits` in index.css) because Atkinson draws a slashed zero.
- **Inputs:** `muted` fill, `input` border, visible 2 px leaf focus ring. Time pickers are wheel style.

## 6. Anti-patterns (do not do these in this app)
1. Red for missed days, broken streaks or overdue items: use neutral tones and encouraging copy.
2. Pure black (#000) or pure white page backgrounds, grey shadows, neon or saturated primaries.
3. Streak-shaming, guilt copy, countdown pressure, flashing or shaking animations, confetti loops.
4. Dense dashboards: more than one hero number per card, more than 5 chart colours, 3D or gradient-heavy charts.
5. Text under 11 px, light-grey-on-cream text under 4.5:1, numbers in a display or proportional face.
6. Colour as the only signal (always pair with icon, label or number).
7. Heavy borders and chunky claymorphism, glassmorphism with unreadable blur.
8. Emojis as icons; mixing icon sizes; hover-only information.
9. Hardcoded colours or fonts outside the tokens; adding sample or fake data.
10. Removing or hiding existing buttons or features for visual reasons (ask first).
