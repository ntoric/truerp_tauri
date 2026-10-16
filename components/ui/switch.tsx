"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-all duration-200 outline-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:bg-slate-200 data-[state=unchecked]:shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)] data-[state=unchecked]:hover:bg-slate-300",
      "data-[state=checked]:bg-[linear-gradient(135deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_100%)] data-[state=checked]:shadow-[0_2px_8px_-2px_hsl(var(--theme-600)/0.55),inset_0_1px_0_rgba(255,255,255,0.2)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.25),0_1px_1px_rgba(15,23,42,0.06)] ring-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
