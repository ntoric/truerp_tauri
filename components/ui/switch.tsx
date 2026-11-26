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
      "peer inline-flex h-[1.375rem] w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-all duration-200 outline-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:bg-slate-300 data-[state=unchecked]:hover:bg-slate-400/70",
      "data-[state=checked]:bg-button-gradient",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow-gr-xs ring-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=checked]:translate-x-[1.125rem] data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
