"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Tab selectors follow the Gooseroot brand kit (gooseroot-ui `.gr-tabs`):
 * - `pill` (default): `.gr-tabs--pill` — tinted track, active tab lifts to a card
 *   with the accent colour, bold label and a spring "pop".
 * - `line`: `.gr-tabs--line` — hairline rule, active tab gets a bold label and a
 *   3px brand-gradient underline that grows from the centre.
 * Colours come from the user's accent theme (`--primary`, `--grad-*`).
 */
type TabsVariant = "pill" | "line"

const TabsVariantContext = React.createContext<TabsVariant>("pill")

const Tabs = TabsPrimitive.Root

const listVariants: Record<TabsVariant, string> = {
  pill:
    "inline-flex h-auto min-h-11 max-w-full items-center justify-start gap-1 overflow-x-auto rounded-full border border-border bg-surface-2 p-1 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  line:
    "flex h-auto max-w-full items-center justify-start gap-7 overflow-x-auto border-b border-border pb-0.5 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
}

const triggerBase =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium leading-none text-muted-foreground transition-colors duration-150 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 hover:text-heading disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-bold [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"

const triggerVariants: Record<TabsVariant, string> = {
  pill:
    "rounded-full px-4 py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-gr-xs data-[state=active]:animate-gr-tab-pop data-[state=active]:hover:text-primary",
  line:
    "px-0.5 py-2.5 data-[state=active]:text-heading after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[3px] after:rounded-[3px] after:bg-[linear-gradient(90deg,hsl(var(--grad-start)),hsl(var(--grad-end)))] after:opacity-0 data-[state=active]:after:opacity-100 data-[state=active]:after:animate-gr-tab-underline motion-reduce:animate-none motion-reduce:after:animate-none",
}

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: TabsVariant
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "pill", ...props }, ref) => (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        data-variant={variant}
        className={cn(listVariants[variant], className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
)
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(triggerBase, triggerVariants[variant], "motion-reduce:animate-none", className)}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 outline-none focus-visible:outline-none focus-visible:ring-0",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
export type { TabsVariant }
