import { Toaster as Sonner, toast } from "sonner"
// The app's own theme. next-themes' hook was used here, but the app never mounts its
// provider, so toasts followed the phone's theme instead of the one picked in Profile.
import { useTheme } from "@/contexts/ThemeContext"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Any toast can be flicked away in any direction, not only the default ones for its corner.
      swipeDirections={["left", "right", "top", "bottom"]}
      className="toaster group"
      /*
       * A sensible width instead of a fixed one.
       *
       * Sonner's stock width is 356px, which left "Note pinned!" in a box four times its
       * length. `fit-content` was the obvious fix and is wrong here: the toast lays its
       * content out in a row, so shrinking to fit wrapped the message one character per
       * line and produced a 65px-wide, 247px-tall box. A modest fixed width that messages
       * are free to exceed up to the viewport is both readable and no longer wasteful.
       */
      style={{
        '--width': '280px',
        '--width-mobile': 'calc(100vw - 2rem)',
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:w-fit group-[.toaster]:min-w-[180px] group-[.toaster]:max-w-[min(420px,calc(100vw-2rem))]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground",
          // `!` because Sonner's own button rule has the same specificity, so whichever
          // stylesheet loads last would otherwise decide the colours.
          cancelButton:
            "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
