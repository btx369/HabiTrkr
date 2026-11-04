import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Flame, Lightbulb, Target } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heatmap, BarChart, MonthGrid, ProgressBar, ReportCard, StatTile, WeekDots } from '@/components/reports/ReportParts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeekStart } from '@/contexts/WeekStartContext';
import { useDateLocale } from '@/lib/dateLocale';
import { getLocalStorageItem } from '@/lib/localStorageUtils';
import { toDateKey } from '@/lib/dateUtils';
import { countedSentence } from '@/lib/countedMessage';
import { notesWithReminders } from '@/lib/noteReminders';
import { ReminderChip } from '@/components/notes/ReminderChip';
import {
  isDoneOn,
  eventsPerMonth,
  eventSummary,
  habitReports,
  insights,
  noteSummary,
  periodReport,
  upcomingEvents,
  weekdayLoad,
  weekSummary,
  type HabitReport,
  type Insight,
  type ReportPeriod,
  type WeekStart,
} from '@/lib/reportStats';
import type { Habit } from '@/types/habit';
import type { Event } from '@/types/event';
import type { Note } from '@/types/note';

const DAY_SHORT_KEYS = ['dayShortSunday', 'dayShortMonday', 'dayShortTuesday', 'dayShortWednesday', 'dayShortThursday', 'dayShortFriday', 'dayShortSaturday'] as const;
const percent = (value: number) => `${Math.round(value * 100)}%`;

/** Reports and statistics, computed from the habits, events and notes on this device. */
export default function Reports() {
  const { t, language } = useLanguage();
  const { weekStartsOn } = useWeekStart();
  const dateLocale = useDateLocale();
  const navigate = useNavigate();
  const [tab, setTab] = useState('summary');
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [offset, setOffset] = useState(0);

  const weekStart = weekStartsOn as WeekStart;
  const now = useMemo(() => new Date(), []);

  const data = useMemo(() => {
    const habits = getLocalStorageItem<Habit[]>('habits', []);
    const events = getLocalStorageItem<Event[]>('events', []);
    const archivedEvents = getLocalStorageItem<Event[]>('archivedEvents', []);
    const notes = getLocalStorageItem<Note[]>('notes', []);
    const archivedNotes = getLocalStorageItem<Note[]>('archivedNotes', []);
    return { habits, events, archivedEvents, notes, archivedNotes };
  }, []);

  const stats = useMemo(() => {
    const { habits, events, archivedEvents, notes, archivedNotes } = data;
    const reports = habitReports(habits, now, weekStart);
    return {
      reports,
      weekRate: weekSummary(habits, now, weekStart),
      events: eventSummary(events, archivedEvents, now, weekStart),
      upcoming: upcomingEvents(events, now, 30, 5),
      perMonth: eventsPerMonth([...events, ...archivedEvents], 6, now),
      byWeekday: weekdayLoad(events, now),
      notes: noteSummary(notes, archivedNotes, now, weekStart),
      reminders: notesWithReminders(notes, now),
      nudges: insights(habits, events, now, weekStart, 4),
    };
  }, [data, now, weekStart]);

  const dayName = (jsDay: number) => t(DAY_SHORT_KEYS[jsDay]);
  const insightText = (i: Insight): { text: string; to: string } => {
    switch (i.kind) {
      case 'missedYesterday': return { text: t('reportsMissedYesterday').replace('{name}', i.habit.name), to: '/' };
      case 'dueToday': return { text: t('reportsDueToday').replace('{name}', i.habit.name), to: '/' };
      case 'streakAtRisk': return { text: t('reportsStreakAtRisk').replace('{name}', i.habit.name).replace('{days}', String(i.days)), to: '/' };
      case 'weekBehind': return { text: t('reportsWeekBehind').replace('{name}', i.habit.name).replace('{remaining}', String(i.remaining)), to: '/' };
      case 'eventToday': return { text: t('reportsEventToday').replace('{name}', i.event.name), to: '/calendar' };
    }
  };
  const streakText = (r: HabitReport) =>
    countedSentence(t, language, r.streak.unit === 'weeks' ? 'weeksCount' : 'daysCount', r.streak.current);

  const withGoal = stats.reports.some((r) => r.kind !== 'open');
  const streaks = [...stats.reports].filter((r) => r.streak.current > 0).sort((a, b) => b.streak.current - a.streak.current).slice(0, 4);

  const periodData = useMemo(() => periodReport(data.habits, period, now, offset, weekStart), [data.habits, period, now, offset, weekStart]);

  /** A month calendar or a whole-year grid: one column per week, shaded by check-ins. */
  const heatWeeks = useMemo(() => {
    if (period === 'week') return [];
    const max = Math.max(1, data.habits.length);
    const today = startOfDay(now);
    const first = startOfWeek(periodData.from, { weekStartsOn });
    const weeks = Math.ceil((Math.round((periodData.to.getTime() - first.getTime()) / 86400000) + 1) / 7);
    return Array.from({ length: weeks }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(first, w * 7 + d);
        if (date < periodData.from || date > periodData.to) return null;
        const key = toDateKey(date);
        const count = data.habits.filter((h) => isDoneOn(h, key)).length;
        return {
          key,
          day: date.getDate(),
          level: Math.min(1, count / max),
          label: `${format(date, 'PP', { locale: dateLocale })}: ${count}`,
          future: date > today,
          today: date.getTime() === today.getTime(),
        };
      })
    );
  }, [period, periodData, data.habits, now, weekStartsOn, dateLocale]);

  const periodLabel = (() => {
    const { from, to } = periodData;
    if (period === 'year') return String(from.getFullYear());
    if (period === 'month') return format(from, 'LLLL yyyy', { locale: dateLocale });
    if (offset === 0) return t('reportsThisWeek');
    return `${format(from, 'd MMM', { locale: dateLocale })} – ${format(to, 'd MMM', { locale: dateLocale })}`;
  })();
  const maxDayCount = Math.max(1, data.habits.length);
  const todayStart = startOfDay(now);
  const periodBars = periodData.buckets.map((b) => {
    if (period === 'week') {
      return {
        label: dayName(b.start.getDay()),
        value: b.start > todayStart ? null : b.count / maxDayCount,
        display: String(b.count),
        highlight: b.start.getTime() === todayStart.getTime(),
      };
    }
    return {
      label: period === 'month' ? format(b.start, 'd/M', { locale: dateLocale }) : format(b.start, 'LLLLL', { locale: dateLocale }),
      value: b.rate,
      display: b.rate === null ? '' : percent(b.rate),
      highlight: b.start <= todayStart && todayStart <= b.end,
    };
  });

  const orderedWeekdays = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const maxWeekday = Math.max(1, ...stats.byWeekday);
  const maxMonth = Math.max(1, ...stats.perMonth.map((m) => m.count));

  const nothingYet = data.habits.length === 0 && data.events.length + data.archivedEvents.length === 0 && stats.notes.total === 0;

  return (
    <Layout pageTitle={t('reports')} showSearch={false}>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="fixed top-16 left-0 right-0 z-40 px-2">
          <div className="flex items-center justify-between py-2">
            <SlidingTabsList activeValue={tab} values={['summary', 'habits', 'events']}>
              <TabsTrigger value="summary">{t('reportsSummary')}</TabsTrigger>
              <TabsTrigger value="habits">{t('habits')}</TabsTrigger>
              <TabsTrigger value="events">{t('events')}</TabsTrigger>
            </SlidingTabsList>
          </div>
        </div>

        {nothingYet ? (
          <p className="mt-24 px-6 text-center text-muted-foreground">{t('reportsNothingYet')}</p>
        ) : (
          <>
            <TabsContent value="summary" className="mt-14 space-y-3">
              <ReportCard title={t('reportsThisWeek')}>
                <div className="flex gap-2">
                  <StatTile label={t('reportsHabitsDone')} value={stats.weekRate === null ? '–' : percent(stats.weekRate)} />
                  <StatTile label={t('events')} value={`${stats.events.thisWeekPast}/${stats.events.thisWeek}`} />
                </div>
                {stats.weekRate !== null && <div className="mt-3"><ProgressBar value={stats.weekRate} label={t('reportsHabitsDone')} /></div>}
                {!withGoal && <p className="mt-3 text-sm text-muted-foreground">{t('reportsNoGoalHabits')}</p>}
              </ReportCard>

              <ReportCard title={t('reportsToday')} icon={<Lightbulb size={16} />}>
                {stats.nudges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('reportsAllCaughtUp')}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.nudges.map((nudge, i) => {
                      const { text, to } = insightText(nudge);
                      return (
                        <li key={i}>
                          <button type="button" onClick={() => navigate(to)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm text-foreground">
                            <span>{text}</span>
                            <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ReportCard>

              {streaks.length > 0 && (
                <ReportCard title={t('reportsStreaks')} icon={<Flame size={16} />}>
                  <div className="grid grid-cols-2 gap-2">
                    {streaks.map((r) => (
                      <div key={r.habit.id} className="rounded-2xl border border-border bg-muted/40 p-3">
                        <p className="truncate text-sm font-medium text-foreground">{r.habit.name}</p>
                        <p className="text-lg font-semibold text-foreground">{streakText(r)}</p>
                      </div>
                    ))}
                  </div>
                </ReportCard>
              )}

              <ReportCard title={t('reportsUpcoming')} icon={<CalendarDays size={16} />}>
                <UpcomingList upcoming={stats.upcoming} onOpen={() => navigate('/calendar')} />
              </ReportCard>

              <ReportCard title={t('reportsNoteReminders')} icon={<BellRing size={16} />}>
                {stats.reminders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('reportsNoReminders')}</p>
                ) : (
                  <ul className="divide-y divide-border" data-testid="reports-note-reminders">
                    {stats.reminders.slice(0, 8).map(({ note }) => (
                      <li key={note.id}>
                        <button
                          type="button"
                          onClick={() => navigate('/notes', { state: { openNoteId: note.id } })}
                          className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm"
                        >
                          <span className="min-w-0 truncate text-foreground">{note.name?.trim() || t('untitledItem')}</span>
                          <ReminderChip reminder={note.reminder!} className="shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ReportCard>
            </TabsContent>

            <TabsContent value="habits" className="mt-14 space-y-3">
              {data.habits.length === 0 ? (
                <p className="mt-10 text-center text-muted-foreground">{t('reportsNoHabits')}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div role="radiogroup" aria-label={t('reportsPeriod')} className="flex rounded-full bg-muted p-1">
                      {(['week', 'month', 'year'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={period === p}
                          onClick={() => {
                            setPeriod(p);
                            setOffset(0);
                          }}
                          className={`rounded-full px-3 py-1.5 text-sm transition-colors ${period === p ? 'bg-foreground font-medium text-background' : 'text-muted-foreground'}`}
                        >
                          {t(p === 'week' ? 'reportsWeek' : p === 'month' ? 'reportsMonth' : 'reportsYear')}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label={t('reportsPrevious')} className="rounded-full p-1.5 hover:bg-hover">
                        <ChevronLeft size={18} />
                      </button>
                      <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} aria-label={t('reportsNext')} className="rounded-full p-1.5 hover:bg-hover disabled:opacity-30">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  <ReportCard title={periodLabel} icon={<Target size={16} />}>
                    <div className="flex gap-2">
                      <StatTile label={t('reportsHabitsDone')} value={periodData.rate === null ? '–' : percent(periodData.rate)} />
                      <StatTile label={t('reportsCheckIns')} value={periodData.count} />
                    </div>
                    {periodData.rate !== null && <div className="mt-3"><ProgressBar value={periodData.rate} label={t('reportsHabitsDone')} /></div>}
                    <div className="mt-4">
                      <BarChart bars={periodBars} height={period === 'week' ? 72 : 96} />
                    </div>
                  </ReportCard>

                  {period !== 'week' && (
                    <ReportCard title={t('reportsDailyActivity')}>
                      {period === 'month'
                        ? <MonthGrid weeks={heatWeeks} dayLabels={orderedWeekdays.map(dayName)} />
                        : <Heatmap weeks={heatWeeks} rowLabels={[]} compact />}
                    </ReportCard>
                  )}

                  {periodData.habits.map((h) => {
                    const r = stats.reports.find((x) => x.habit.id === h.habit.id);
                    return (
                      <ReportCard key={h.habit.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{h.habit.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {h.kind === 'open' || h.rate === null
                                ? countedSentence(t, language, 'daysCount', h.count)
                                : `${percent(h.rate)} · ${h.done}/${h.expected}`}
                            </p>
                          </div>
                          {period === 'week' && offset === 0 && r && <WeekDots days={r.last7} />}
                        </div>
                        {h.rate !== null && h.kind !== 'open' && <div className="mt-3"><ProgressBar value={h.rate} label={h.habit.name} /></div>}
                        {r && (
                          <div className="mt-3 flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5 text-foreground"><Flame size={14} />{streakText(r)}</span>
                            <span className="text-muted-foreground">{t('reportsBest').replace('{count}', String(r.streak.best))}</span>
                          </div>
                        )}
                      </ReportCard>
                    );
                  })}
                </>
              )}
            </TabsContent>

            <TabsContent value="events" className="mt-14 space-y-3">
              <ReportCard>
                <div className="flex gap-2">
                  <StatTile label={t('reportsThisWeek')} value={stats.events.thisWeek} />
                  <StatTile label={t('reportsRecurring')} value={stats.events.recurring} />
                  <StatTile label={t('reportsOneOff')} value={stats.events.oneOff} />
                </div>
              </ReportCard>

              <ReportCard title={t('reportsEventsPerMonth')}>
                <BarChart
                  bars={stats.perMonth.map((m, i) => ({
                    label: format(m.month, 'MMM', { locale: dateLocale }),
                    value: m.count / maxMonth,
                    display: String(m.count),
                    highlight: i === stats.perMonth.length - 1,
                  }))}
                />
              </ReportCard>

              <ReportCard title={t('reportsByWeekday')}>
                <BarChart
                  bars={orderedWeekdays.map((d) => ({ label: dayName(d), value: stats.byWeekday[d] / maxWeekday, display: String(stats.byWeekday[d]), highlight: stats.byWeekday[d] === maxWeekday }))}
                  height={72}
                />
              </ReportCard>

              <ReportCard title={t('reportsUpcoming')} icon={<CalendarDays size={16} />}>
                <UpcomingList upcoming={stats.upcoming} onOpen={() => navigate('/calendar')} />
              </ReportCard>
            </TabsContent>
          </>
        )}
      </Tabs>
    </Layout>
  );
}

function UpcomingList({ upcoming, onOpen }: { upcoming: ReturnType<typeof upcomingEvents>; onOpen: () => void }) {
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  if (upcoming.length === 0) return <p className="text-sm text-muted-foreground">{t('reportsNoUpcoming')}</p>;
  const today = startOfDay(new Date());
  return (
    <ul className="divide-y divide-border">
      {upcoming.map(({ event, date }) => {
        const time = event.startTime || event.time;
        const when = date.getTime() === today.getTime() ? t('today') : format(date, 'EEE d MMM', { locale: dateLocale });
        return (
          <li key={`${event.id}-${toDateKey(date)}`}>
            <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
              <span className="min-w-0 truncate text-foreground">{event.name}</span>
              <span className="shrink-0 text-muted-foreground">{when}{time && !event.isAllDay ? ` · ${time}` : ''}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
