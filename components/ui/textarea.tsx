import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-300 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
