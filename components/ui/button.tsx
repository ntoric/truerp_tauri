import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/*
  Gooseroot button family (gooseroot-ui .gr-btn):
  primary  — Red → Crimson gradient, lifts 1px with the accent shadow on hover
  outline  — "secondary" in the kit: surface + strong hairline, accent on hover
  secondary— "soft": tint fill with the strong accent text
  ghost    — muted text, tint on hover
  ink      — Deep Wine strong neutral (replaces black buttons)
*/
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out outline-none focus-visible:outline-none focus-visible:ring-0 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary bg-button-gradient text-primary-foreground hover:-translate-y-px hover:shadow-gr-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:-translate-y-px hover:shadow-[0_10px_24px_hsl(var(--destructive)/0.28)]",
        outline:
          "border border-input bg-card text-heading hover:border-primary hover:text-primary",
        secondary:
          "bg-tint text-[hsl(var(--theme-700))] hover:bg-[hsl(var(--theme-100))] dark:bg-[hsl(var(--theme-500)/0.15)] dark:text-[hsl(var(--theme-300))] dark:hover:bg-[hsl(var(--theme-500)/0.24)]",
        ghost: "text-muted-foreground hover:bg-accent hover:text-primary",
        ink: "bg-[hsl(var(--theme-900))] text-white hover:-translate-y-px hover:shadow-gr-md dark:bg-[#fff4f4] dark:text-[#161314]",
        link: "text-primary underline-offset-4 hover:text-[hsl(var(--theme-700))] hover:underline",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-11 rounded-xl px-6 text-[15px]",
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
