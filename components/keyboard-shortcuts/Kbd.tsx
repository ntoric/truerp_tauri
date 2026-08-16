import { cn } from '@/lib/utils'
import { formatShortcutKeys, type ShortcutKey } from '@/lib/keyboardShortcuts'

export function Kbd({
  keys,
  className,
  size = 'md',
  tone = 'default',
}: {
  keys: ShortcutKey
  className?: string
  size?: 'sm' | 'md'
  tone?: 'default' | 'inverse'
}) {
  const parts = formatShortcutKeys(keys)
  const compact = size === 'sm'

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-0.5">
          {index > 0 && (
            <span
              className={cn(
                'text-[10px]',
                tone === 'inverse' ? 'text-white/70' : 'text-gray-400'
              )}
            >
              +
            </span>
          )}
          <kbd
            className={cn(
              'inline-flex items-center justify-center rounded border font-medium shadow-sm',
              compact
                ? 'min-h-[18px] min-w-[18px] px-1 text-[10px] leading-none'
                : 'min-h-[22px] min-w-[22px] px-1.5 text-[11px]',
              tone === 'inverse'
                ? 'border-white/30 bg-white/15 text-white shadow-none'
                : 'border-gray-200 bg-gray-50 text-gray-700'
            )}
          >
            {part}
          </kbd>
        </span>
      ))}
    </span>
  )
}
