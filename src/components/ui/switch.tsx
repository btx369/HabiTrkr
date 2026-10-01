import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    /*
     * ON is blue, from --switch-on. Both references do this and it is what people now read
     * as "on"; the surrounding palette is warm and has no blue in it, which is exactly why
     * the signal stands out. Kept identical in light and dark so "on" does not change
     * identity with the theme.
     *
     * The hover steps the fill DOWN rather than up: against a saturated colour, lightening
     * reads as disabled while darkening reads as pressed.
     */
    className={cn(
      /*
       * 36x20 track with a 16px knob. It was 44x24 with a 20px knob — the stock shadcn size,
       * which reads as oversized next to the rest of this interface. Sizing down is a single
       * change here because every switch in the app goes through this component.
       *
       * 44 -> 36 and 24 -> 20 are not the same ratio on purpose: the track shrinks more than
       * the knob so the knob keeps a visible 2px inset at the top and bottom, which is what
       * stops it looking like it is about to fall out.
       */
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-switch-on data-[state=checked]:border-switch-on data-[state=unchecked]:bg-muted-foreground/40 hover:data-[state=unchecked]:bg-muted-foreground/50 hover:data-[state=checked]:bg-switch-on/90",
      className
    )}
    {...props}
    ref={ref}
  >
    {/*
      * White knob in both themes. `bg-background` was near-white in light but near-BLACK in
      * dark, which put a dark knob on the blue fill; on a blue track the knob has to be
      * white or the switch reads as inverted.
      *
      * The travel is 16px: track 36 minus knob 16 minus 2px of border and inset either side.
      */}
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
