import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  /*
   * No `hover:scale` / `active:scale`. Every button in the app used to grow 2% on hover and
   * shrink 2% on press, which made the whole interface feel like it was breathing — the Add
   * button beside a tag field, Cancel, Save Changes. The stylesheet already had scale
   * overrides in four other files on top of this one, so removing it here also removes the
   * default that those were repeating.
   *
   * Feedback now comes from the background token alone, the same `hover:bg-hover` every other
   * clickable surface uses, so buttons react the way the rest of the app does.
   *
   * `transition-all` stays: it still animates colour and border, which is what the hover is.
   */
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary hover:bg-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /*
         * Hover comes from `hover:bg-hover`, the single shared hover surface defined in
         * index.css, so every clickable element in the app reacts identically. That token
         * is a low-alpha veil of the foreground rather than the solid --accent swatch: a
         * veil adapts to whatever sits underneath (page, white card, coloured note),
         * whereas a filled colour has to be right for all of them and was wrong for most.
         *
         * Three traps live here.
         *
         * Do NOT reintroduce `hover:bg-foreground/6`: 6 is not on Tailwind's opacity
         * scale, so the class compiles to nothing and the button silently loses its
         * hover entirely.
         *
         * Do NOT use --accent: at 95% against a white card it is invisible, which is what
         * made the note menu dots look white.
         *
         * And a `dark:` fill needs a `dark:hover:` counterpart. `dark:bg-muted` compiles to
         * `.dark .dark\:x` — two classes of specificity — while `hover:bg-hover` is
         * `.hover\:x:hover`, one class plus a pseudo-class; the `dark:` rule is emitted
         * later, so it won in EVERY state and the button had no hover in dark mode at all.
         * `dark:hover:bg-hover` matches that specificity, which is the same fix
         * TagSuggestions already uses. A `dark:bg-transparent` does not help: it is still a
         * `dark:` utility and still outranks the plain hover.
         */
        outline:
          "border border-input bg-background dark:bg-muted text-foreground hover:bg-hover hover:text-foreground dark:hover:bg-hover dark:hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "bg-transparent hover:bg-hover hover:text-foreground",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
