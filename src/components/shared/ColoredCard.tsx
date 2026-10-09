import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isDefaultColor } from "@/lib/cardColorStyles";
import { useTheme } from "@/contexts/ThemeContext";

interface ColoredCardProps extends React.HTMLAttributes<HTMLDivElement> {
  color: string;
  /** Use fallback styling for default colors (useful for dialogs/lists) */
  useFallback?: boolean;
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
 * Applies the colour as a translucent background and forces black text when a colour is applied.
 */
export const ColoredCard = React.forwardRef<HTMLDivElement, ColoredCardProps>(
  ({ color, useFallback = false, className, children, ...props }, ref) => {
    const hasColor = !isDefaultColor(color);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Personal colors stay softly blended; the default surface follows the explicit item-card token.
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
      backgroundColor: 'hsl(var(--item-card-surface))',
      '--card-hover-color': 'hsl(var(--hover))',
    } as React.CSSProperties;

    return (
      <Card
        ref={ref}
        className={cn(
          hasColor && "border-black/10",
          /*
           * No tap or click animation. This carried `transition-transform duration-150`
           * for a "subtle scale on tap" that no longer exists — the scale itself was
           * removed and the transition was left behind, animating nothing. Cards still
           * shrink while being dragged (`scale-105` on the drag ghost) and that is a
           * different thing, driven by its own class at the call site.
           */
          /*
           * A coloured card paints its own text black, because every note colour in the
           * palette is a light tint. This used to be conditional on a `forceBackground`
           * flag, which existed for cards nested inside a coloured folder; that flag only
           * ever changed which translucent surface a nested card used, so the condition
           * went with it. Note that a card nested in a coloured folder still composites
           * over that folder's colour — measured and deliberately kept, see NoteFolderCard.
           */
          hasColor && "text-[#000000] [&_.text-muted-foreground]:text-[#000000]/70 [&_.text-foreground]:text-[#000000]",
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
