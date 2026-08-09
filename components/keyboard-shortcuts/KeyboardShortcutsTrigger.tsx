'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils'

interface KeyboardShortcutsTriggerProps {
  variant?: 'header' | 'compact'
  className?: string
}

export default function KeyboardShortcutsTrigger({
  variant = 'header',
  className,
}: KeyboardShortcutsTriggerProps) {
  const { togglePanel, panelOpen } = useKeyboardShortcuts()

  if (variant === 'compact') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={togglePanel}
        className={cn('h-8 w-8 p-0', panelOpen && 'bg-gray-100', className)}
        title="Keyboard shortcuts (Alt)"
        aria-label="Show keyboard shortcuts"
        aria-pressed={panelOpen}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={togglePanel}
      className={cn('gap-2', panelOpen && 'bg-gray-100', className)}
      title="Keyboard shortcuts (Alt)"
      aria-label="Show keyboard shortcuts"
      aria-pressed={panelOpen}
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden lg:inline">Shortcuts</span>
    </Button>
  )
}
