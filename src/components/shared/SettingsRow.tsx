import { ChevronRight } from 'lucide-react';

/** The rounded panel that groups settings rows (Profile, Security, ...). */
export const settingsPanelClass = 'bg-card border border-border shadow-[var(--surface-shadow)] rounded-[20px]';

/** A titled group of settings rows. */
export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">{title}</h3>
      <div className={`${settingsPanelClass} overflow-hidden`}>{children}</div>
    </div>
  );
}

export const SettingsDivider = () => <div className="h-px bg-border mx-4" />;

export interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  labelClassName?: string;
}

export function SettingsRow({ icon, label, value, onClick, rightElement, showChevron, labelClassName }: SettingsRowProps) {
  // Hover uses the muted surface, which in light reads as a soft beige (rgb(239,237,236)).
  //
  // This previously read `[@media_(hover:_hover)]:hover:bg-foreground/5`. Tailwind did not
  // compile that arbitrary variant, so no rule was ever emitted and these rows had NO
  // hover at all. A plain `hover:` class is generated and works.
  /*
   * `text-sm` is explicit here on purpose. Without it the label inherited the body's 16px,
   * which made it LARGER than the value beside it (text-sm) and larger than the section
   * headings (also text-sm) — an inverted hierarchy. Measured against grok.com, whose
   * labels sit at 14px, this was the one screen in the app rendering a full step too big.
   */
  const rowClass = 'flex items-center justify-between p-4 transition-colors';
  const rowHover = 'cursor-pointer hover:bg-hover active:bg-muted';
  const labelSide = (
    <div className="flex items-center gap-3">
      <span className="text-foreground">{icon}</span>
      <span className={`text-sm font-medium ${labelClassName || 'text-foreground'}`}>{label}</span>
    </div>
  );
  const valueSide = (
    <div className="flex items-center gap-2">
      {value && <span className="text-muted-foreground text-sm">{value}</span>}
      {/*
        * The control keeps its clicks to itself. A tap on the switch is meant to change the
        * setting once, and without this the row's own click handler would run on the same
        * tap and set the same value a second time.
        */}
      {rightElement && <span onClick={(event) => event.stopPropagation()}>{rightElement}</span>}
      {showChevron && <ChevronRight size={20} className="text-muted-foreground" />}
    </div>
  );

  /*
   * A row that ends in a control is a container, not a button.
   *
   * It used to be a `<button>` in every case, which put the Theme and Notifications switches
   * — themselves buttons — inside a button. A button inside a button is invalid HTML, React
   * reported it on every visit to this screen, and the two handlers ran off the same click,
   * setting the value twice. The row is still clickable, so tapping the label works as
   * before, and the switch remains the keyboard-reachable control for those two settings.
   */
  if (rightElement) {
    return (
      <div className={`${rowClass} ${onClick ? rowHover : ''}`} onClick={onClick}>
        {labelSide}
        {valueSide}
      </div>
    );
  }

  if (onClick) {
    // text-sm on the button itself, not just inside it: the wrapper was still computing to
    // the 16px body size, which is what a text measurement of the row reports.
    return <button onClick={onClick} className={`w-full text-left text-sm focus:outline-none ${rowClass} ${rowHover}`}>{labelSide}{valueSide}</button>;
  }
  return <div className={rowClass}>{labelSide}{valueSide}</div>;
}
