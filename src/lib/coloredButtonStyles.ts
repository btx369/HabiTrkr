/**
 * Helper utilities for styling icon buttons on coloured surfaces.
 * Prevents dark theme issues by avoiding button variants that include
 * conflicting hover text colors (hover:text-accent-foreground) or
 * theme-specific backgrounds (dark:bg-muted).
 * 
 * USAGE:
 * For coloured surfaces (notes, events, habits with custom colors):
 * - Use variant="ghostStatic" to avoid hover text/bg overrides
 * - Apply manual hover backgrounds (black/10, black/20)
 * - Icons inherit black from parent container
 * 
 * For non-coloured surfaces:
 * - Use standard ghost/outline variants
 * - Apply hover:bg-hover, the shared hover token from index.css
 *
 * Never use --accent for hover: at 95% lightness it is invisible against a white card,
 * which is what made the 3-dot menu on a default-coloured note look like it turned white.
 */

type ButtonVariant = 'ghost' | 'ghostStatic' | 'outline' | 'default';

interface ColoredButtonConfig {
  /** Button variant to use */
  variant: ButtonVariant;
  /** Additional className for styling */
  className: string;
}

/**
 * Get button configuration for icon buttons on potentially colored surfaces.
 * Use this for header buttons (back, search, close) and toolbar buttons.
 * 
 * @param hasColor - Whether the parent surface has a custom color
 * @param options - Additional configuration options
 * @returns Configuration object with variant and className
 * 
 * @example
 * const { variant, className } = getColoredIconButtonStyles(hasColor);
 * <Button variant={variant} className={`h-8 w-8 p-0 rounded-full ${className}`}>
 */
export function getColoredIconButtonStyles(
  hasColor: boolean,
  options?: {
    /** Base variant for non-colored surfaces. Default: 'ghost' */
    baseVariant?: 'ghost' | 'outline';
    /** Size of the button for sizing adjustments */
    size?: 'sm' | 'md';
  }
): ColoredButtonConfig {
  const baseVariant = options?.baseVariant ?? 'ghost';
  
  if (hasColor) {
    return {
      variant: 'ghostStatic',
      className: 'hover:bg-black/10',
    };
  }
  
  return {
    variant: baseVariant,
    className: 'hover:bg-hover',
  };
}

/**
 * Get button configuration for outline-style icon buttons on colored surfaces.
 * Use this for action bar buttons that need a visible border.
 * 
 * @param hasColor - Whether the parent surface has a custom color
 * @returns Configuration object with variant and className
 * 
 * @example
 * const { variant, className } = getColoredOutlineButtonStyles(hasColor);
 * <Button variant={variant} className={`h-9 w-9 rounded-full p-0 ${className}`}>
 */
export function getColoredOutlineButtonStyles(hasColor: boolean): ColoredButtonConfig {
  if (hasColor) {
    return {
      variant: 'ghostStatic',
      className: 'border border-[#000000]/30 hover:bg-black/20',
    };
  }
  
  return {
    variant: 'outline',
    className: 'border-border hover:bg-hover',
  };
}

/**
 * Get the appropriate text/icon color class for colored surfaces.
 * Icons should be black on colored surfaces, theme-aware otherwise.
 * 
 * @param hasColor - Whether the parent surface has a custom color
 * @returns CSS class for text/icon color
 */
export function getColoredIconClass(hasColor: boolean): string {
  return hasColor ? 'text-[#000000]' : 'text-foreground';
}

/**
 * Get border color class for elements on colored surfaces.
 * 
 * @param hasColor - Whether the parent surface has a custom color
 * @param opacity - Opacity level for the black border (default: 30)
 * @returns CSS class for border color
 */
export function getColoredBorderClass(hasColor: boolean, opacity: number = 30): string {
  return hasColor ? `border-[#000000]/${opacity}` : 'border-border';
}
