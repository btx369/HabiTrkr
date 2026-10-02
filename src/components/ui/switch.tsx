import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    /*
     * ON is a solid near-black fill in light mode and near-white in dark, both from
     * --switch-on. That is the same inversion --primary makes, so a switch agrees with the
     * filled buttons beside it instead of importing a colour the palette does not contain.
     *
     * The hover steps the fill DOWN in light mode: against near-black, a lighter fill reads
     * as disabled and a darker one as pressed. In dark mode the direction is irrelevant —
     * the fill is already at the top of its range — so the same rule applying weakly there
     * is fine rather than worth a second variant.
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
      * The knob takes `--primary-foreground`, so it inverts with the fill: white on the
      * near-black track in light mode, dark on the near-white track in dark. A fixed white
      * knob would vanish into the dark theme's fill and leave nothing to read as a knob.
      */}
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-primary-foreground shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
