import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronRight, Flame, Lightbulb, NotebookText, Target } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heatmap, BarChart, ProgressBar, ReportCard, StatTile, WeekDots } from '@/components/reports/ReportParts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeekStart } from '@/contexts/WeekStartContext';
import { useDateLocale } from '@/lib/dateLocale';
import { getLocalStorageItem } from '@/lib/localStorageUtils';
import { toDateKey } from '@/lib/dateUtils';
import { countedSentence } from '@/lib/countedMessage';
import {
  dailyActivity,
  eventsPerMonth,
  eventSummary,
  habitReports,
  insights,
  noteSummary,
  upcomingEvents,
  weekdayLoad,
  weeklyRates,
  weekSummary,
  type HabitReport,
  type Insight,
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
    const today = startOfDay(now);
    const heatStart = startOfWeek(addDays(today, -7 * 11), { weekStartsOn });
    const activity = dailyActivity(habits, Math.round((today.getTime() - heatStart.getTime()) / 86400000) + 1, now);
    return {
      reports,
      weekRate: weekSummary(habits, now, weekStart),
      rates: weeklyRates(habits, 8, now, weekStart),
      activity,
      heatStart,
      events: eventSummary(events, archivedEvents, now, weekStart),
      upcoming: upcomingEvents(events, now, 30, 5),
      perMonth: eventsPerMonth([...events, ...archivedEvents], 6, now),
      byWeekday: weekdayLoad(events, now),
      notes: noteSummary(notes, archivedNotes, now, weekStart),
      nudges: insights(habits, events, now, weekStart, 4),
    };
  }, [data, now, weekStart, weekStartsOn]);

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

  const heatWeeks = useMemo(() => {
    const byKey = new Map(stats.activity.map((a) => [a.key, a.count]));
    const max = Math.max(1, data.habits.length);
    const today = startOfDay(now);
    return Array.from({ length: 12 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(stats.heatStart, w * 7 + d);
        const key = toDateKey(date);
        return { key, level: Math.min(1, (byKey.get(key) ?? 0) / max), label: `${format(date, 'PP', { locale: dateLocale })}: ${byKey.get(key) ?? 0}`, future: date > today };
      })
    );
  }, [stats, data.habits.length, now, dateLocale]);

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

              <ReportCard title={t('notes')} icon={<NotebookText size={16} />}>
                <div className="flex gap-2">
                  <StatTile label={t('noteCount')} value={stats.notes.total} />
                  <StatTile label={t('reportsNewThisWeek')} value={stats.notes.newThisWeek} />
                </div>
                {stats.notes.topTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label={t('reportsTopTags')}>
                    {stats.notes.topTags.map(({ tag, count }) => (
                      <span key={tag} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">#{tag} · {count}</span>
                    ))}
                  </div>
                )}
              </ReportCard>
            </TabsContent>

            <TabsContent value="habits" className="mt-14 space-y-3">
              {data.habits.length === 0 ? (
                <p className="mt-10 text-center text-muted-foreground">{t('reportsNoHabits')}</p>
              ) : (
                <>
                  <ReportCard title={t('reportsWeeklyRate')} icon={<Target size={16} />}>
                    <BarChart
                      bars={stats.rates.map((r, i) => ({
                        label: format(r.weekStart, 'd/M', { locale: dateLocale }),
                        value: r.rate,
                        display: r.rate === null ? '' : percent(r.rate),
                        highlight: i === stats.rates.length - 1,
                      }))}
                    />
                  </ReportCard>

                  <ReportCard title={t('reportsActivity')}>
                    <Heatmap weeks={heatWeeks} rowLabels={orderedWeekdays.map(dayName)} />
                  </ReportCard>

                  {stats.reports.map((r) => (
                    <ReportCard key={r.habit.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{r.habit.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.kind === 'open' ? t('reportsOpenHabit') : r.rate30 === null ? '–' : `${t('reportsLast30')}: ${percent(r.rate30)}`}
                          </p>
                        </div>
                        <WeekDots days={r.last7} />
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-foreground"><Flame size={14} />{streakText(r)}</span>
                        <span className="text-muted-foreground">{t('reportsBest').replace('{count}', String(r.streak.best))}</span>
                      </div>
                    </ReportCard>
                  ))}
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
