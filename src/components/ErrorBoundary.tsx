import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translateNow } from '@/contexts/LanguageContext';

interface State {
  failed: boolean;
}

/**
 * Last line of defence: if a screen throws while rendering (a note saved by an older version
 * with a missing field, say), the app shows a short message and a Reload button instead of a
 * blank white page. Nothing is deleted: the data lives in localStorage and is untouched.
 *
 * It sits outside the providers, so it only uses `translateNow`, which reads the saved
 * language straight from storage.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center" role="alert">
        <h1 className="font-display text-2xl font-bold text-foreground">{translateNow('errorTitle')}</h1>
        <p className="max-w-sm text-muted-foreground">{translateNow('errorBody')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {translateNow('errorReload')}
        </button>
      </main>
    );
  }
}
