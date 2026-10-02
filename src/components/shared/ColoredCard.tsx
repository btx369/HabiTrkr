import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCardColorStyles, getCardColorStylesWithFallback, isDefaultColor } from "@/lib/cardColorStyles";
import { useTheme } from "@/contexts/ThemeContext";

interface ColoredCardProps extends React.HTMLAttributes<HTMLDivElement> {
  color: string;
  /** Use fallback styling for default colors (useful for dialogs/lists) */
  useFallback?: boolean;
  /** Force background even for default colors (useful for nested cards inside colored parents) */
  forceBackground?: boolean;
  children: React.ReactNode;
}

/**
 * Convert hex color to rgba for glass effect
 */
function hexToRgba(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Hover tint for a control sitting on a coloured card.
 *
 * Returns the card colour nudged by the same amount in both themes, using --accent as
 * the single source of that amount. Tuned against Grok's hover, which shifts a surface
 * by roughly 5-14% — the point is a faint tint, not a block of a different colour.
 *
 * In dark mode a tint that moves toward white overshoots badly: the raised surface sits
 * near 14% lightness, so a big lift lands on the border grey and the control flashes far
 * lighter than the card it sits on. Mixing a small amount at low alpha avoids that.
 */
function getHoverColor(hexColor: string, isDark: boolean): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // The card is translucent, so a light wash over it reads close to --accent in both
  // themes. Keeping the two in step is what makes a control hover look the same whether
  // it sits on a coloured card or the page.
  const amount = isDark ? 0.06 : 0.12;
  const alpha = isDark ? 0.45 : 0.6;

  const mixR = Math.min(255, Math.round(r + (255 - r) * amount));
  const mixG = Math.min(255, Math.round(g + (255 - g) * amount));
  const mixB = Math.min(255, Math.round(b + (255 - b) * amount));

  return `rgba(${mixR}, ${mixG}, ${mixB}, ${alpha})`;
}

/**
 * A Card wrapper that automatically applies consistent color styling.
 * Uses getCardColorStyles to apply background color and forces black text when color is applied.
 */
export const ColoredCard = React.forwardRef<HTMLDivElement, ColoredCardProps>(
  ({ color, useFallback = false, forceBackground = false, className, children, ...props }, ref) => {
    const hasColor = !isDefaultColor(color);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // For glass effect: use solid semi-transparent color at 75% opacity
    const glassStyles: React.CSSProperties = hasColor ? {
      backgroundColor: hexToRgba(color, 0.75),
      '--card-hover-color': getHoverColor(color, isDark),
    } as React.CSSProperties : {
      /*
       * An uncoloured card hovers with the shared veil, NOT --accent. Those two are far
       * apart in practice: --accent sits at 95% lightness against a white card, so a
       * hover using it is all but invisible — which is why the 3-dot menu on a
       * default-coloured note appeared to turn white while a coloured note was fine.
       */
      '--card-hover-color': 'hsl(var(--hover))',
    } as React.CSSProperties;
    
    // For forceBackground (nested cards), use slightly more opaque glass
    if (forceBackground && !hasColor) {
      glassStyles.backgroundColor = 'hsl(var(--glass-bg))';
    }

    return (
      <Card
        ref={ref}
        className={cn(
          /*
           * No tap or click animation. This carried `transition-transform duration-150`
           * for a "subtle scale on tap" that no longer exists — the scale itself was
           * removed and the transition was left behind, animating nothing. Cards still
           * shrink while being dragged (`scale-105` on the drag ghost) and that is a
           * different thing, driven by its own class at the call site.
           */
          // Only apply text color overrides when card has a color AND is not using forceBackground
          hasColor && !forceBackground && "text-[#000000] [&_.text-muted-foreground]:text-[#000000]/70 [&_.text-foreground]:text-[#000000]",
          // When forceBackground is used, ensure text follows normal theme rules
          forceBackground && "text-foreground [&_.text-muted-foreground]:text-muted-foreground [&_.text-foreground]:text-foreground",
          className
        )}
        style={glassStyles}
        {...props}
      >
        {children}
      </Card>
    );
  }
);

ColoredCard.displayName = "ColoredCard";
