"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col p-4 md:max-w-[360px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl",
    "border border-white/70 bg-white/85 p-3.5 pr-9 text-foreground",
    "shadow-[0_1px_1px_rgba(0,0,0,0.06),0_4px_8px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.14),0_24px_48px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.75)]",
    "ring-1 ring-black/5",
    "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
    "backdrop-blur-xl backdrop-saturate-150 transition-all",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
    "dark:border-white/15 dark:bg-white/10 dark:text-foreground",
    "dark:shadow-[0_1px_1px_rgba(0,0,0,0.35),0_6px_12px_rgba(0,0,0,0.35),0_16px_36px_rgba(0,0,0,0.45),0_28px_56px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)]",
    "dark:ring-white/10",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "before:bg-sky-500",
        info: "before:bg-sky-500",
        success: "before:bg-emerald-500",
        warning: "before:bg-amber-500",
        destructive: "before:bg-red-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const toastIconMap = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
} as const

const toastIconClassMap = {
  default: "text-sky-600 dark:text-sky-400",
  info: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-red-600 dark:text-red-400",
} as const

type ToastVariant = NonNullable<VariantProps<typeof toastVariants>["variant"]>

function ToastIcon({ variant = "default" }: { variant?: ToastVariant | null }) {
  const key = (variant ?? "default") as ToastVariant
  const Icon = toastIconMap[key] ?? Info
  return (
    <div
      className={cn(
        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
        key === "success" && "bg-emerald-500/10",
        key === "destructive" && "bg-red-500/10",
        key === "warning" && "bg-amber-500/10",
        (key === "info" || key === "default") && "bg-sky-500/10"
      )}
    >
      <Icon
        className={cn("h-4 w-4", toastIconClassMap[key] ?? toastIconClassMap.default)}
        aria-hidden
      />
    </div>
  )
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-black/5 bg-white/50 px-2.5 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-white/80 outline-none focus:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1.5 top-1.5 rounded-md p-1 text-foreground/40 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 outline-none focus:outline-none focus-visible:ring-0 group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
}
