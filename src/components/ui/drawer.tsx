import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { useKeyboardViewport } from "@/hooks/useKeyboardViewport"

const Drawer = ({
  shouldScaleBackground = true,
  // vaul's own keyboard handling resizes the sheet when a field is focused and, on Android,
  // often fails to restore it afterwards, leaving the sheet squashed with the footer far
  // above the bottom. DrawerContent follows the keyboard itself (useKeyboardViewport).
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    repositionInputs={repositionInputs}
    {...props}
  />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { style?: React.CSSProperties }
>(({ className, children, style, ...props }, ref) => {
  // While the keyboard is open the sheet is limited to, and lifted above, the visible area;
  // with the keyboard closed nothing is overridden, so it always returns to normal.
  const keyboard = useKeyboardViewport(true)
  const keyboardStyle: React.CSSProperties | undefined = keyboard
    ? { maxHeight: keyboard.height, bottom: window.innerHeight - keyboard.height - keyboard.top }
    : undefined
  return (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-fit max-h-[100dvh] md:max-h-[85vh] flex-col rounded-t-[10px] transition-transform duration-300 ease-out",
        "bg-popover border-t border-border backdrop-blur-xl",
        className
      )}
      style={{ ...style, ...keyboardStyle }}
      {...props}
    >
      <div className={cn(
        "mx-auto mt-4 h-2 w-[100px] rounded-full shrink-0",
        // Use themed handle colors for default card background, black overlay for custom colors
        (style?.backgroundColor && style.backgroundColor !== 'hsl(var(--card))') 
          ? "bg-black/20" 
          : "bg-black dark:bg-white"
      )} />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
  )
})
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
