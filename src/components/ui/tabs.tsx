import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-full p-1 text-muted-foreground",
      "bg-[rgba(242,244,247,0.75)] dark:bg-[hsl(var(--glass-bg))]",
      "backdrop-blur-[12px]",
      "border border-[rgba(255,255,255,0.4)] dark:border-[hsl(var(--glass-border))]",
      "shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

interface SlidingTabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  activeValue: string;
  values: string[];
}

const SlidingTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  SlidingTabsListProps
>(({ className, activeValue, values, children, ...props }, ref) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState({ left: 0, width: 0 });

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const activeIndex = values.indexOf(activeValue);
    const triggers = container.querySelectorAll('[role="tab"]');
    const activeTab = triggers[activeIndex] as HTMLElement;
    
    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      });
    }
  }, [activeValue, values]);

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "relative inline-flex h-10 items-center justify-center rounded-full p-1 text-muted-foreground",
        "bg-[rgba(242,244,247,0.75)] dark:bg-[hsl(var(--glass-bg))]",
        "backdrop-blur-[12px]",
        "border border-[rgba(255,255,255,0.4)] dark:border-[hsl(var(--glass-border))]",
        "shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    >
      <div ref={containerRef} className="relative flex">
        {/* Sliding indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full bg-black shadow-sm transition-all duration-300"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
        {/* Tab triggers (rendered above the indicator) */}
        {children}
      </div>
    </TabsPrimitive.List>
  );
});
SlidingTabsList.displayName = "SlidingTabsList"

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-white",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, SlidingTabsList, TabsTrigger, TabsContent }
