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
          "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-heading transition-[border-color,box-shadow] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/80 hover:border-[hsl(var(--theme-300))] outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-[hsl(var(--destructive)/0.05)]",
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
