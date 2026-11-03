/** Facts about the app shown in Help/About and attached to feedback. */

/** From package.json, injected at build time (vite.config.ts `define`). */
export const APP_VERSION: string = __APP_VERSION__;

/**
 * Where "Feedback" messages go. The app has no server, so feedback opens the user's own
 * email app with the message filled in; it is only sent if they press send there.
 * Empty until an address is chosen: the email app then opens with no recipient.
 */
export const SUPPORT_EMAIL = '';

/** Builds the mailto: link for a feedback message, with version and device for context. */
export function feedbackMailto(category: string, message: string): string {
  const body = `${message}\n\n---\nHabiTrkr ${APP_VERSION}\n${navigator.userAgent}`;
  const params = new URLSearchParams({ subject: `[HabiTrkr] ${category}`, body });
  // URLSearchParams encodes spaces as "+", which some mail apps show literally.
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}
