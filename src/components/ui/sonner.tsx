import { useEffect, useRef } from "react"
import { Toaster as Sonner, toast, useSonner } from "sonner"
// The app's own theme. next-themes' hook was used here, but the app never mounts its
// provider, so toasts followed the phone's theme instead of the one picked in Profile.
import { useTheme } from "@/contexts/ThemeContext"

// On a wide window toasts stay inside the content column (max-w-3xl), 8px in from its right edge.
const TOAST_RIGHT = 'max(16px, calc((100vw - 48rem) / 2 + 8px))'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  // On a phone a toast is flicked away; with a mouse there was no way to do the same. Clicking
  // anywhere on a toast now dismisses it, except on its own buttons (Undo, close), which keep
  // their meaning. Sonner puts no id on the element, so the clicked toast is found through its
  // position in the stack (`data-index`), which follows the same order as `useSonner().toasts`.
  const { toasts } = useSonner()
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const item = target?.closest?.('[data-sonner-toast]') as HTMLElement | null
      if (!item || target?.closest('button, a, [data-button], [data-cancel], [data-close-button]')) return
      const id = toastsRef.current[Number(item.dataset.index)]?.id
      if (id !== undefined) toast.dismiss(id)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Any toast can be flicked away in any direction, not only the default ones for its corner.
      swipeDirections={["left", "right", "top", "bottom"]}
      className="toaster group"
      // Above the bottom navigation bar (16px from the edge, 56px tall) and the Add button,
      // which toasts used to cover for a few seconds.
      offset={{ bottom: 'calc(76px + env(safe-area-inset-bottom))', right: TOAST_RIGHT }}
      mobileOffset={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
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
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:w-fit group-[.toaster]:min-w-[180px] group-[.toaster]:max-w-[min(420px,calc(100vw-2rem))]",
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
