import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useRipple } from "@/hooks/useRipple"

const buttonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary hover:bg-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background dark:bg-muted text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
        /** Like ghost, but with NO hover styles (for icon buttons that should not react on hover). */
        ghostStatic: "bg-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const { ref: rippleRef, createRipple } = useRipple<HTMLButtonElement>();
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(e);
      onClick?.(e);
    };

    // Combined ref handler for both ripple and forwarded ref
    const setRefs = React.useCallback((node: HTMLButtonElement | null) => {
      (rippleRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref, rippleRef]);

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={setRefs}
          onClick={handleClick}
          {...props}
        />
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={setRefs}
        onClick={handleClick}
        {...props}
      />
    );
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
