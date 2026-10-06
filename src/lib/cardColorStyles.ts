/**
 * Shared utility for applying consistent color styling to cards throughout the app.
 * Use this to maintain the colored card pattern with background and left border.
 */

export const DEFAULT_CARD_COLOR = '#FFFFFF';

export interface CardColorStyles {
  backgroundColor?: string;
}

/**
 * Returns inline styles with a muted fallback for default colors.
 * Useful for items in dialogs/lists where you want visible styling even for default colors.
 */
export function getCardColorStylesWithFallback(color: string): CardColorStyles {
  if (isDefaultColor(color)) {
    return {
      backgroundColor: 'hsl(var(--muted))',
    };
  }
  
  return {
    backgroundColor: color,
  };
}

/**
 * Check if a color is the default (no color applied)
 */
export function isDefaultColor(color: string): boolean {
  return color === DEFAULT_CARD_COLOR || !color;
}
