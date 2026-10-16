import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,box-shadow] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 hover:border-slate-300 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          className
        )}
        ref={ref}
        aria-invalid={className?.includes('border-red') ? true : undefined}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
