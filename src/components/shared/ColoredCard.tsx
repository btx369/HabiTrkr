import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCardColorStyles, getCardColorStylesWithFallback, isDefaultColor } from "@/lib/cardColorStyles";

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
 * Generate a hover color that's slightly lighter than the base color
 */
function getHoverColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const lighterR = Math.min(255, Math.round(r + (255 - r) * 0.25));
  const lighterG = Math.min(255, Math.round(g + (255 - g) * 0.25));
  const lighterB = Math.min(255, Math.round(b + (255 - b) * 0.25));
  
  return `rgba(${lighterR}, ${lighterG}, ${lighterB}, 0.6)`;
}

/**
 * A Card wrapper that automatically applies consistent color styling.
 * Uses getCardColorStyles to apply background color and forces black text when color is applied.
 */
export const ColoredCard = React.forwardRef<HTMLDivElement, ColoredCardProps>(
  ({ color, useFallback = false, forceBackground = false, className, children, ...props }, ref) => {
    const hasColor = !isDefaultColor(color);
    
    // For glass effect: use solid semi-transparent color at 75% opacity
    const glassStyles: React.CSSProperties = hasColor ? {
      backgroundColor: hexToRgba(color, 0.75),
      '--card-hover-color': getHoverColor(color),
    } as React.CSSProperties : {
      '--card-hover-color': 'hsl(var(--muted))',
    } as React.CSSProperties;
    
    // For forceBackground (nested cards), use slightly more opaque glass
    if (forceBackground && !hasColor) {
      glassStyles.backgroundColor = 'hsl(var(--glass-bg))';
    }

    return (
      <Card
        ref={ref}
        className={cn(
          // Micro-interaction: subtle scale on tap/click
          "transition-transform duration-150 ease-out active:scale-[0.98]",
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
