import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { settingsPanelClass } from '@/components/shared/SettingsRow';

/** A titled card: every block on the Reports page sits in one. */
export function ReportCard({ title, icon, children, className }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(settingsPanelClass, 'p-4', className)}>
      {title && (
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/** A big number with a label, for the tiles at the top of a tab. */
export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold leading-tight text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A thin progress bar, 0..1. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

export interface Bar {
  label: string;
  /** 0..1 height of the bar; null draws an empty slot. */
  value: number | null;
  /** Text shown above the bar (and read by screen readers). */
  display: string;
  highlight?: boolean;
}

/** A simple column chart. Heights are relative to the bars given, so pass 0..1 values. */
export function BarChart({ bars, height = 96 }: { bars: Bar[]; height?: number }) {
  return (
    <div className="flex items-end gap-1.5" style={{ height: height + 36 }} role="img" aria-label={bars.map((b) => `${b.label}: ${b.display}`).join(', ')}>
      {bars.map((bar) => (
        <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[11px] leading-none text-muted-foreground">{bar.value === null ? '' : bar.display}</span>
          <div className="flex w-full items-end" style={{ height }}>
            <div
              className={cn('w-full rounded-t-md', bar.highlight ? 'bg-foreground' : 'bg-foreground/35', bar.value === null && 'bg-transparent')}
              style={{ height: bar.value === null ? 0 : Math.max(3, Math.round(bar.value * height)) }}
            />
          </div>
          <span className="w-full truncate text-center text-[11px] leading-none text-muted-foreground">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Contribution-style grid: one column per week, one row per weekday, shade = how many habits were done. */
export function Heatmap({ weeks, rowLabels, compact = false }: {
  weeks: Array<Array<{ key: string; level: number; label: string; future?: boolean } | null>>;
  rowLabels: string[];
  /** A whole year: 53 narrow columns of square cells with tighter gaps. */
  compact?: boolean;
}) {
  const cellHeight = compact ? 'aspect-square' : 'h-4';
  return (
    <div className={compact ? 'flex gap-[2px]' : 'flex gap-1'} role="img" aria-label={rowLabels.join(', ')}>
      {rowLabels.length > 0 && (
        <div className="flex flex-col gap-1 pr-1 text-[11px] text-muted-foreground">
          {rowLabels.map((label, i) => (
            <span key={i} className="flex h-4 items-center">{i % 2 === 0 ? label : ''}</span>
          ))}
        </div>
      )}
      {weeks.map((week, w) => (
        <div key={w} className={cn('flex min-w-0 flex-1 flex-col', compact ? 'gap-[2px]' : 'gap-1')}>
          {week.map((cell, d) =>
            cell ? (
              <div
                key={cell.key}
                className={cn(cellHeight, compact ? 'rounded-[2px]' : 'rounded-[4px]', cell.future ? 'bg-transparent' : 'bg-foreground')}
                style={{ opacity: cell.future ? 0 : cell.level === 0 ? 0.08 : 0.25 + cell.level * 0.75 }}
              />
            ) : (
              <div key={d} className={cellHeight} />
            )
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A month as a calendar: one row per week, one column per weekday, each day numbered and
 * shaded by how many habits were done. `null` cells are days outside the month.
 */
export function MonthGrid({ weeks, dayLabels }: {
  weeks: Array<Array<{ key: string; day: number; level: number; label: string; future?: boolean; today?: boolean } | null>>;
  dayLabels: string[];
}) {
  return (
    <div className="mx-auto grid max-w-sm grid-cols-7 gap-1" role="img" aria-label={dayLabels.join(', ')}>
      {dayLabels.map((label, i) => (
        <span key={`h${i}`} className="pb-1 text-center text-[11px] text-muted-foreground">{label}</span>
      ))}
      {weeks.flat().map((cell, i) =>
        cell ? (
          <div key={cell.key} className={cn('relative flex aspect-square items-center justify-center rounded-md text-[11px]', cell.today && 'ring-2 ring-foreground ring-offset-1 ring-offset-background')}>
            <div
              className="absolute inset-0 rounded-md bg-foreground"
              style={{ opacity: cell.future ? 0.03 : cell.level === 0 ? 0.08 : 0.25 + cell.level * 0.75 }}
            />
            <span className={cn('relative', !cell.future && cell.level > 0.5 ? 'text-background' : 'text-foreground')}>{cell.day}</span>
          </div>
        ) : (
          <div key={`e${i}`} />
        )
      )}
    </div>
  );
}

/** Seven small dots for the last week of a habit: done, missed, or not applicable. */
export function WeekDots({ days }: { days: Array<{ key: string; state: 'done' | 'missed' | 'off' | 'future' }> }) {
  return (
    <div className="flex gap-1">
      {days.map((d) => (
        <span
          key={d.key}
          className={cn(
            'h-3 w-3 rounded-full border',
            d.state === 'done' && 'border-foreground bg-foreground',
            d.state === 'missed' && 'border-destructive/60 bg-destructive/25',
            (d.state === 'off' || d.state === 'future') && 'border-border bg-transparent'
          )}
        />
      ))}
    </div>
  );
}
