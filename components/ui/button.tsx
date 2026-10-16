import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-150 ease-out outline-none focus-visible:outline-none focus-visible:ring-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(0,0,0,0.18)_100%)] text-primary-foreground shadow-[0_1px_2px_rgba(16,24,40,0.12),0_4px_12px_-4px_hsl(var(--primary)/0.6),inset_0_1px_0_rgba(255,255,255,0.2)] hover:brightness-105 hover:shadow-[0_1px_2px_rgba(16,24,40,0.12),0_8px_18px_-6px_hsl(var(--primary)/0.65),inset_0_1px_0_rgba(255,255,255,0.2)]",
        destructive:
          "bg-destructive bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(0,0,0,0.18)_100%)] text-destructive-foreground shadow-[0_1px_2px_rgba(16,24,40,0.12),0_4px_12px_-4px_hsl(var(--destructive)/0.55),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-105",
        outline:
          "border border-slate-300 bg-white text-[#20212b] shadow-[0_1px_2px_rgba(16,24,40,0.06),inset_0_-1px_0_rgba(16,24,40,0.05)] hover:border-slate-400 hover:bg-slate-100 hover:text-[#20212b]",
        secondary: "bg-slate-200/90 text-[#20212b] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-slate-300/80",
        ghost: "hover:bg-slate-200/80 hover:text-[#20212b]",
        link: "text-primary underline-offset-4 hover:text-[hsl(var(--theme-700))] hover:underline active:scale-100",
      },
      size: {
        default: "h-8 px-3.5 text-sm",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
