import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrateStorageKeys } from './lib/storageMigration'

// Carry any values from renamed localStorage keys to their current names before the
// app reads anything, so a rebrand never looks like lost data.
migrateStorageKeys();

createRoot(document.getElementById("root")!).render(<App />);
