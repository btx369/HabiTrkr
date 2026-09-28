/**
 * Builds realistic demo data for the responsive audit.
 *
 * Shapes here must match the app's own types (src/types/*) and storage keys, otherwise
 * the seeded screens render empty and the audit tells you nothing. Date keys are
 * `yyyy-MM-dd` in LOCAL time, matching src/lib/dateUtils.ts.
 *
 * Storage keys come from ./storage-keys.mjs, which mirrors src/lib/storageKeys.ts.
 * Hardcoding them here is how the audit previously ended up writing to keys the app had
 * already migrated away from, so the seeded theme silently never applied.
 */

import { STORAGE_KEYS } from './storage-keys.mjs';

const pad2 = (v) => String(v).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const shift = (base, days) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

const iso = (d, h = 9, m = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();

/**
 * Produces a populated store: habits in all three tracking modes (plus per-day
 * counts), folders, archived items, notes of every type, and upcoming events.
 */
export function buildSeed({ dark = false } = {}) {
  const today = new Date();
  const monday = shift(today, -(((today.getDay() + 6) % 7))); // week start = Monday

  // -- habits -------------------------------------------------------------
  const habits = [
    {
      id: 'h-water',
      name: 'Drink 8 glasses of water',
      description: 'Stay hydrated through the day',
      color: '#BFDBFE',
      createdAt: iso(shift(today, -60)),
      activeDays: [true, true, true, true, true, true, true],
      completedDates: [0, 1, 2, 3].map((i) => dateKey(shift(monday, i))),
      completionCounts: {},
      pinned: true,
    },
    {
      id: 'h-read',
      name: 'Read for 20 minutes',
      description: 'Any book counts',
      color: '#DDD6FE',
      createdAt: iso(shift(today, -45)),
      activeDays: [true, true, true, true, true, false, false],
      completedDates: [0, 1, 2].map((i) => dateKey(shift(monday, i))),
      completionCounts: {},
    },
    {
      // Number of days + times per day
      id: 'h-gym',
      name: 'Go to the gym',
      description: '5 days a week, 2 sets of cardio',
      color: '#FCA5A5',
      createdAt: iso(shift(today, -30)),
      activeDays: [true, false, true, false, true, true, false],
      useNumberOfDays: true,
      numberOfDaysPerWeek: 5,
      useTimesPerDay: true,
      timesPerDay: 2,
      completedDates: [0, 2].map((i) => dateKey(shift(monday, i))),
      completionCounts: {
        [dateKey(shift(monday, 0))]: 2,
        [dateKey(shift(monday, 2))]: 1,
      },
    },
    {
      // Unlimited times
      id: 'h-water-bottle',
      name: 'Refill water bottle',
      description: 'Unlimited — track as you go',
      color: '#A7F3D0',
      createdAt: iso(shift(today, -20)),
      activeDays: [true, true, true, true, true, true, true],
      useUnlimitedTimes: true,
      completedDates: [],
      completionCounts: {
        [dateKey(shift(monday, 0))]: 3,
        [dateKey(shift(monday, 1))]: 5,
        [dateKey(shift(monday, 2))]: 2,
        [dateKey(today)]: 4,
      },
    },
    {
      id: 'h-meditate',
      name: 'Meditate',
      description: '10 minutes of stillness',
      color: '#FEF3C7',
      createdAt: iso(shift(today, -14)),
      activeDays: [true, true, true, true, true, true, true],
      completedDates: [1, 3].map((i) => dateKey(shift(monday, i))),
      completionCounts: {},
    },
    {
      id: 'h-journal',
      name: 'Write in journal',
      description: 'A few lines is enough',
      color: '#FED7AA',
      createdAt: iso(shift(today, -7)),
      activeDays: [true, true, true, true, true, true, true],
      completedDates: [],
      completionCounts: {},
    },
    {
      id: 'h-standup',
      name: 'Morning stretch',
      description: 'Before breakfast',
      color: '#FFFFFF',
      createdAt: iso(shift(today, -5)),
      activeDays: [true, true, true, true, true, true, true],
      completedDates: [dateKey(today)],
      completionCounts: {},
    },
    {
      id: 'h-vitamins',
      name: 'Take vitamins',
      description: 'With lunch',
      color: '#86EFAC',
      createdAt: iso(shift(today, -3)),
      activeDays: [true, true, true, true, true, true, true],
      completedDates: [],
      completionCounts: {},
      pinned: true,
    },
  ];

  const habitFolders = [
    {
      id: 'hf-health',
      name: 'Health',
      description: 'Body and mind',
      color: '#A7F3D0',
      createdAt: iso(shift(today, -50)),
      habitIds: ['h-water', 'h-gym', 'h-vitamins'],
    },
    {
      id: 'hf-growth',
      name: 'Personal growth',
      description: 'Learning habits',
      color: '#DDD6FE',
      createdAt: iso(shift(today, -40)),
      habitIds: ['h-read', 'h-meditate', 'h-journal'],
    },
    {
      id: 'hf-routine',
      name: 'Daily routine',
      description: 'Small things, every day',
      color: '#BFDBFE',
      createdAt: iso(shift(today, -10)),
      habitIds: ['h-water-bottle', 'h-standup'],
      pinned: true,
    },
  ];

  const archivedHabits = [
    {
      id: 'h-old-1',
      name: 'Learn Spanish',
      description: '15 minutes a day',
      color: '#C4B5FD',
      createdAt: iso(shift(today, -120)),
      activeDays: [true, true, true, true, true, true, true],
      completedDates: [],
      completionCounts: {},
      archived: true,
    },
    {
      id: 'h-old-2',
      name: 'Weekly review',
      description: 'Sunday evening planning',
      color: '#9CA3AF',
      createdAt: iso(shift(today, -90)),
      activeDays: [false, false, false, false, false, false, true],
      completedDates: [],
      completionCounts: {},
      archived: true,
    },
  ];

  const archivedHabitFolders = [
    {
      id: 'hf-old',
      name: 'Retired habits',
      description: 'Kept for reference',
      color: '#9CA3AF',
      createdAt: iso(shift(today, -100)),
      habitIds: [],
      archived: true,
    },
  ];

  // -- notes --------------------------------------------------------------
  const notes = [
    {
      id: 'n-text-1',
      name: 'Weekly goals',
      type: 'text',
      color: '#FEF3C7',
      createdAt: iso(shift(today, -2), 8, 15),
      modifiedAt: iso(shift(today, -1), 20, 5),
      pinned: true,
      tags: ['goals', 'weekly'],
      description:
        'Finish the responsive layout pass, ship the new icon set, and write up the release notes for the beta.',
    },
    {
      id: 'n-text-2',
      name: 'Book notes — Deep Work',
      type: 'text',
      color: '#A7F3D0',
      createdAt: iso(shift(today, -9), 21, 40),
      pinned: false,
      tags: ['books'],
      description:
        'Chapter 3: the ability to concentrate without distraction is becoming rarer precisely as it becomes more valuable.',
    },
    {
      id: 'n-list-1',
      name: 'Groceries',
      type: 'list',
      color: '#BFDBFE',
      createdAt: iso(shift(today, -1), 18, 30),
      pinned: false,
      tags: ['home'],
      items: [
        { id: 'i1', text: 'Oats', completed: true },
        { id: 'i2', text: 'Greek yoghurt', completed: true },
        { id: 'i3', text: 'Blueberries', completed: false },
        { id: 'i4', text: 'Olive oil', completed: false },
        { id: 'i5', text: 'Coffee beans', completed: false },
      ],
    },
    {
      id: 'n-list-2',
      name: 'Packing list',
      type: 'list',
      color: '#FED7AA',
      createdAt: iso(shift(today, -5), 11, 0),
      pinned: false,
      items: [
        { id: 'p1', text: 'Passport', completed: true },
        { id: 'p2', text: 'Charger', completed: false },
        { id: 'p3', text: 'Headphones', completed: false },
      ],
    },
    {
      id: 'n-img-1',
      name: 'Whiteboard sketch',
      type: 'image',
      color: '#DDD6FE',
      createdAt: iso(shift(today, -3), 14, 20),
      pinned: false,
      tags: ['ideas'],
      imageUrl: '/images/background.png',
      description: 'Rough idea for the dashboard layout',
    },
    {
      id: 'n-text-3',
      name: 'Recipe — overnight oats',
      type: 'text',
      color: '#FCA5A5',
      createdAt: iso(shift(today, -12), 9, 10),
      pinned: false,
      description: 'Equal parts oats and milk, a spoon of chia, leave overnight. Top with fruit in the morning.',
    },
    {
      id: 'n-text-4',
      name: 'Meeting notes',
      type: 'text',
      color: '#86EFAC',
      createdAt: iso(shift(today, -6), 15, 45),
      pinned: false,
      description: 'Agreed to split the release into two milestones and revisit the notification schedule next week.',
    },
    {
      id: 'n-locked',
      name: 'Private thoughts',
      type: 'text',
      color: '#C4B5FD',
      createdAt: iso(shift(today, -4), 22, 0),
      pinned: false,
      locked: true,
      pin: '1234',
      description: 'Locked note contents',
    },
  ];

  const folders = [
    {
      id: 'f-work',
      name: 'Work',
      description: 'Projects and meetings',
      color: '#BFDBFE',
      createdAt: iso(shift(today, -30)),
      noteIds: ['n-text-1', 'n-text-4'],
    },
    {
      id: 'f-personal',
      name: 'Personal',
      description: 'Everything else',
      color: '#DDD6FE',
      createdAt: iso(shift(today, -25)),
      noteIds: ['n-list-1', 'n-text-3'],
      pinned: true,
    },
    {
      id: 'f-ideas',
      name: 'Ideas',
      description: 'Sketches and sparks',
      color: '#FED7AA',
      createdAt: iso(shift(today, -8)),
      noteIds: ['n-img-1'],
    },
  ];

  const archivedNotes = [
    {
      id: 'n-arch-1',
      name: 'Old shopping list',
      type: 'list',
      color: '#9CA3AF',
      createdAt: iso(shift(today, -70)),
      pinned: false,
      archived: true,
      items: [{ id: 'a1', text: 'Batteries', completed: true }],
    },
    {
      id: 'n-arch-2',
      name: 'Conference notes',
      type: 'text',
      color: '#9CA3AF',
      createdAt: iso(shift(today, -55)),
      pinned: false,
      archived: true,
      description: 'Archived write-up from last year.',
    },
  ];

  const archivedFolders = [
    {
      id: 'f-arch',
      name: 'Archive 2025',
      description: 'Last year',
      color: '#9CA3AF',
      createdAt: iso(shift(today, -200)),
      noteIds: [],
      archived: true,
    },
  ];

  // -- events -------------------------------------------------------------
  const events = [
    {
      id: 'e-1',
      name: 'Team standup',
      description: 'Daily sync',
      color: '#BFDBFE',
      createdAt: iso(shift(today, -20)),
      isRecurrent: true,
      startDate: dateKey(today),
      startTime: '09:30',
      endDate: dateKey(today),
      endTime: '09:45',
      recurrenceType: 'daily',
      recurrenceInterval: 1,
      alertType: '5min',
      location: 'Zoom',
    },
    {
      id: 'e-2',
      name: 'Dentist appointment',
      description: 'Six-month check-up',
      color: '#FCA5A5',
      createdAt: iso(shift(today, -15)),
      isRecurrent: false,
      startDate: dateKey(shift(today, 2)),
      startTime: '14:00',
      endDate: dateKey(shift(today, 2)),
      endTime: '15:00',
      location: 'Clínica Central',
      alertType: '1day',
    },
    {
      id: 'e-3',
      name: "Mum's birthday",
      description: 'Order the cake',
      color: '#FEF3C7',
      createdAt: iso(shift(today, -40)),
      isRecurrent: true,
      startDate: dateKey(shift(today, 5)),
      isAllDay: true,
      recurrenceType: 'yearly',
      recurrenceInterval: 1,
      alertType: '4weeks',
    },
    {
      id: 'e-4',
      name: 'Gym class',
      description: 'Spin',
      color: '#A7F3D0',
      createdAt: iso(shift(today, -10)),
      isRecurrent: true,
      startDate: dateKey(shift(today, 1)),
      startTime: '18:30',
      endDate: dateKey(shift(today, 1)),
      endTime: '19:15',
      recurrenceType: 'weekly',
      recurrenceInterval: 1,
      recurrenceDays: [2, 4],
      location: 'FitZone',
    },
    {
      id: 'e-5',
      name: 'Quarterly review',
      description: 'Prep the numbers first',
      color: '#DDD6FE',
      createdAt: iso(shift(today, -30)),
      isRecurrent: false,
      startDate: dateKey(shift(today, 9)),
      startTime: '11:00',
      endDate: dateKey(shift(today, 9)),
      endTime: '12:30',
      alertType: '30min',
    },
  ];

  const eventFolders = [
    {
      id: 'ef-work',
      name: 'Work',
      description: 'Meetings',
      color: '#BFDBFE',
      createdAt: iso(shift(today, -25)),
      eventIds: ['e-1', 'e-5'],
    },
    {
      id: 'ef-personal',
      name: 'Personal',
      description: 'Family and health',
      color: '#FCA5A5',
      createdAt: iso(shift(today, -20)),
      eventIds: ['e-2', 'e-3', 'e-4'],
      pinned: true,
    },
  ];

  return {
    habits,
    archivedHabits,
    habitFolders,
    archivedHabitFolders,
    notes,
    archivedNotes,
    folders,
    archivedFolders,
    events,
    archivedEvents: [
      {
        id: 'e-arch',
        name: 'Past holiday',
        description: 'Already happened',
        color: '#9CA3AF',
        createdAt: iso(shift(today, -80)),
        isRecurrent: false,
        startDate: dateKey(shift(today, -30)),
        isAllDay: true,
      },
    ],
    eventFolders,
    archivedEventFolders: [],
    [STORAGE_KEYS.weekStart]: 'monday',
    [STORAGE_KEYS.theme]: dark ? 'dark' : 'light',
    [STORAGE_KEYS.language]: 'en',
    // Pre-set the rename marker so the app's storage migration does not run during an
    // audit and move these values out from under the assertions.
    'habitrkr.storageKeysMigrated': new Date().toISOString(),
  };
}
