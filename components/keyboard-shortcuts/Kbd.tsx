import { cn } from '@/lib/utils'
import { formatShortcutKeys, type ShortcutKey } from '@/lib/keyboardShortcuts'

export function Kbd({ keys, className }: { keys: ShortcutKey; className?: string }) {
  const parts = formatShortcutKeys(keys)

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-xs text-gray-400">+</span>}
          <kbd className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-gray-200 bg-gray-50 px-1.5 text-[11px] font-medium text-gray-700 shadow-sm">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  )
}
