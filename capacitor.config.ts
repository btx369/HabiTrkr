import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.habitvault.tracker',
  appName: 'HabiTrkr',
  webDir: 'dist',
  // NOTE: No `server.url` override — the native app loads the web assets
  // bundled into `dist` via `npx cap sync`. This keeps the app fully offline
  // and independent of any external hosting.
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6B4E9B',
    },
  },
};

export default config;
