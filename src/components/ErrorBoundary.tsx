import { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Last line of defence: a render error used to leave a blank screen with no way out.
 * Everything lives on this device, so the fallback offers the two things that matter:
 * reload, and a raw copy of the stored data. It cannot use the language context (it may be
 * the thing that failed), so it reads the saved language key directly and keeps its text short.
 */
interface Props { children: ReactNode }
interface State { failed: boolean }

const TEXT: Record<string, { title: string; reload: string; save: string }> = {
  pt: { title: 'Algo correu mal', reload: 'Recarregar', save: 'Guardar cópia dos dados' },
  en: { title: 'Something went wrong', reload: 'Reload', save: 'Save a copy of my data' },
};

function saveRawData() {
  const data: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) data[k] = localStorage.getItem(k);
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'habitrkr-raw-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    let lang = 'en';
    try { lang = localStorage.getItem('habitrkr.language') ?? 'en'; } catch { /* keep English */ }
    const tx = TEXT[lang] ?? TEXT.en;
    const btn = 'h-11 rounded-full px-5 text-sm font-medium';
    return (
      <div role="alert" className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center bg-background text-foreground">
        <h1 className="text-xl font-semibold">{tx.title}</h1>
        <div className="flex flex-wrap justify-center gap-3">
          <button className={`${btn} bg-primary text-primary-foreground`} onClick={() => window.location.reload()}>{tx.reload}</button>
          <button className={`${btn} border border-border`} onClick={saveRawData}>{tx.save}</button>
        </div>
      </div>
    );
  }
}
