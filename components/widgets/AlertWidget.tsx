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
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    text: 'text-yellow-800',
    action: 'text-yellow-700 hover:text-yellow-800',
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    text: 'text-red-800',
    action: 'text-red-700 hover:text-red-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    text: 'text-blue-800',
    action: 'text-blue-700 hover:text-blue-800',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    text: 'text-green-800',
    action: 'text-green-700 hover:text-green-800',
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
    <div className={`rounded-lg border ${classes.border} ${classes.bg} p-4`}>
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
            onClick={onDismiss}
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
