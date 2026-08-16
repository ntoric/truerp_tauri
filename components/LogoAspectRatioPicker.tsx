'use client'

import { cn } from '@/lib/utils'
import {
  LOGO_ASPECT_OPTIONS,
  type LogoAspectRatio,
} from '@/lib/logoAspect'

interface LogoAspectRatioPickerProps {
  value: LogoAspectRatio
  onChange: (value: LogoAspectRatio) => void
  disabled?: boolean
}

export default function LogoAspectRatioPicker({
  value,
  onChange,
  disabled = false,
}: LogoAspectRatioPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LOGO_ASPECT_OPTIONS.map((opt) => {
        const selected = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-center transition-colors',
              selected
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <span
              className={cn(
                'rounded-sm border-2',
                selected ? 'border-blue-600 bg-blue-100' : 'border-gray-400 bg-gray-100',
                opt.frameClass
              )}
            />
            <span className="text-xs font-medium leading-none">{opt.label}</span>
            <span className="text-[10px] leading-none text-gray-500">{opt.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
