'use client'

import { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface AlertWidgetProps {
  icon?: LucideIcon
  message: string
  variant?: 'warning' | 'danger' | 'info' | 'success'
  action?: {
    label: string
    href: string
  }
  onDismiss?: () => void
}

const variantClasses = {
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200 border-l-amber-500',
    icon: 'text-amber-600',
    text: 'text-amber-900',
    action: 'text-amber-800 hover:text-amber-900',
  },
  danger: {
    bg: 'bg-[#fff1f2]',
    border: 'border-[#fecdd3] border-l-[#c81e3a]',
    icon: 'text-[#c81e3a]',
    text: 'text-[#7f1d1d]',
    action: 'text-[#c81e3a] hover:text-[#991b1b]',
  },
  info: {
    bg: 'bg-white',
    border: 'border-[#e4e6ef] border-l-[#111111]',
    icon: 'text-[#111111]',
    text: 'text-[#20212b]',
    action: 'text-blue-700 hover:text-blue-800',
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200 border-l-emerald-500',
    icon: 'text-emerald-600',
    text: 'text-emerald-900',
    action: 'text-emerald-800 hover:text-emerald-900',
  },
}

export default function AlertWidget({
  icon: Icon,
  message,
  variant = 'warning',
  action,
  onDismiss,
}: AlertWidgetProps) {
  const classes = variantClasses[variant]

  return (
    <div className={`rounded-xl border border-l-4 ${classes.border} ${classes.bg} p-4`}>
      <div className="flex items-start gap-3">
        {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${classes.icon} mt-0.5`} />}
        <div className="flex-1">
          <p className={`text-sm font-medium ${classes.text}`}>{message}</p>
          {action && (
            <Link
              href={action.href}
              className={`mt-1 inline-block text-sm font-medium ${classes.action} hover:underline`}
            >
              {action.label}
            </Link>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className={`flex-shrink-0 ${classes.icon} hover:opacity-70 transition-opacity`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
