'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Barcode } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BarcodeScannerInputHandle {
  focus: () => void
  clear: () => void
}

interface BarcodeScannerInputProps {
  onScan: (code: string) => void
  enabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
  /** When true, shows an enable/disable toggle button. */
  showToggle?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
  autoFocusWhenEnabled?: boolean
}

/**
 * Hardware barcode scanner input.
 * USB/Bluetooth scanners type into a focused field and send Enter.
 * Camera scanning is intentionally not used here.
 */
const BarcodeScannerInput = forwardRef<BarcodeScannerInputHandle, BarcodeScannerInputProps>(
  function BarcodeScannerInput(
    {
      onScan,
      enabled = true,
      onEnabledChange,
      showToggle = false,
      placeholder = 'Scan barcode or type item code…',
      className,
      inputClassName,
      autoFocusWhenEnabled = true,
    },
    ref
  ) {
    const [value, setValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => setValue(''),
    }))

    useEffect(() => {
      if (enabled && autoFocusWhenEnabled) {
        const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
        return () => window.clearTimeout(timer)
      }
    }, [enabled, autoFocusWhenEnabled])

    const submit = (raw?: string) => {
      // Hardware scanners fire Enter before React state flushes the last digits.
      // Always read the DOM value so generated 13-digit codes are not truncated.
      const code = (raw ?? inputRef.current?.value ?? value).trim()
      if (!code) return
      onScan(code)
      setValue('')
      if (inputRef.current) inputRef.current.value = ''
      if (enabled) {
        inputRef.current?.focus()
      }
    }

    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showToggle && (
          <Button
            type="button"
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => onEnabledChange?.(!enabled)}
            title={enabled ? 'Disable barcode scanner' : 'Enable barcode scanner'}
          >
            <Barcode className="mr-2 h-4 w-4" />
            {enabled ? 'Scanner On' : 'Barcode scanner'}
          </Button>
        )}
        {enabled && (
          <div className="relative min-w-[220px] flex-1">
            <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  submit(e.currentTarget.value)
                }
              }}
              placeholder={placeholder}
              className={cn('h-9 pl-9 font-mono text-sm', inputClassName)}
              autoComplete="off"
              data-barcode-scanner="true"
            />
          </div>
        )}
        {enabled && showToggle && (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600 whitespace-nowrap">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Ready
          </span>
        )}
      </div>
    )
  }
)

export default BarcodeScannerInput
