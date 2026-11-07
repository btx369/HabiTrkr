import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { migrateStorageKeys } from './lib/storageMigration'
import { initMediaStore } from './lib/mediaStore'

// Carry any values from renamed localStorage keys to their current names before the
// app reads anything, so a rebrand never looks like lost data.
migrateStorageKeys();

// Photos and recordings are loaded from IndexedDB before the first render, so every
// later read stays synchronous. It never throws: on failure notes keep their media inline.
initMediaStore().finally(() => {
  createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);
});
