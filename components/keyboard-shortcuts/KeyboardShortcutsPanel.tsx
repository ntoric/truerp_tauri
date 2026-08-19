'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/keyboard-shortcuts/Kbd'
import type { ShortcutDefinition } from '@/lib/keyboardShortcuts'

interface KeyboardShortcutsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: ShortcutDefinition[]
}

function ShortcutSection({
  title,
  items,
}: {
  title?: string
  items: ShortcutDefinition[]
}) {
  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      {title && (
        <h3 className="px-1 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 first:pt-0">
          {title}
        </h3>
      )}
      {items.map((shortcut) => (
        <div
          key={shortcut.id}
          className="flex items-center justify-between gap-4 rounded-lg px-1 py-2 text-sm"
        >
          <span className="text-gray-800">{shortcut.label}</span>
          <Kbd keys={shortcut.keys} />
        </div>
      ))}
    </div>
  )
}

export default function KeyboardShortcutsPanel({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsPanelProps) {
  const general = shortcuts.filter((s) => s.section === 'general')
  const pos = shortcuts.filter((s) => s.section === 'pos')
  const navigate = shortcuts.filter((s) => s.section === 'navigate')
  const create = shortcuts.filter((s) => s.section === 'create')
  const purchaseInvoice = shortcuts.filter((s) => s.section === 'purchase-invoice')

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close keyboard shortcuts"
          className="fixed inset-0 z-[60] bg-black/20"
          onClick={() => onOpenChange(false)}
        />
      )}

      <aside
        aria-hidden={!open}
        className={cn(
          'fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col border-l bg-white shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        )}
      >
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Keyboard shortcuts</h2>
            <p className="mt-1 text-sm text-gray-500">
              Press <Kbd keys="Alt" className="mx-1 inline-flex" /> to open or close the shortcuts
              panel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ShortcutSection items={general} />
          <ShortcutSection title="POS" items={pos} />
          <ShortcutSection title="Go to" items={navigate} />
          <ShortcutSection title="Create" items={create} />
          <ShortcutSection title="Purchase Invoice" items={purchaseInvoice} />
        </div>
      </aside>
    </>
  )
}
