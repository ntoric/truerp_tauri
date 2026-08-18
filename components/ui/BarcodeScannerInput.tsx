'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
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
  /**
   * Capture USB/Bluetooth scanner keystrokes even when a button or the page
   * body is focused. Skips other text fields so search/qty typing still works.
   */
  captureGlobal?: boolean
}

function isOtherEditableTarget(target: EventTarget | null, input: HTMLInputElement | null) {
  if (!(target instanceof HTMLElement)) return false
  if (input && (target === input || input.contains(target))) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
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
      captureGlobal = false,
    },
    ref
  ) {
    const [value, setValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const onScanRef = useRef(onScan)
    onScanRef.current = onScan

    const focusInput = useCallback(() => {
      const el = inputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
    }, [])

    const clearInput = useCallback(() => {
      setValue('')
      if (inputRef.current) inputRef.current.value = ''
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        focus: focusInput,
        clear: clearInput,
      }),
      [clearInput, focusInput]
    )

    useEffect(() => {
      if (enabled && autoFocusWhenEnabled) {
        const timer = window.setTimeout(focusInput, 50)
        return () => window.clearTimeout(timer)
      }
    }, [enabled, autoFocusWhenEnabled, focusInput])

    const submit = useCallback(
      (raw?: string) => {
        // Hardware scanners fire Enter before React state flushes the last digits.
        // Always read the DOM value so generated 13-digit codes are not truncated.
        const code = (raw ?? inputRef.current?.value ?? value).trim()
        if (!code) return
        onScanRef.current(code)
        clearInput()
        if (enabled) focusInput()
      },
      [clearInput, enabled, focusInput, value]
    )

    const submitRef = useRef(submit)
    submitRef.current = submit

    useEffect(() => {
      if (!enabled || !captureGlobal) return

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.isComposing) return
        if (isOtherEditableTarget(event.target, inputRef.current)) return
        if (event.target === inputRef.current) return

        if (event.key === 'Enter' || event.key === 'Tab') {
          const code = (inputRef.current?.value ?? '').trim()
          if (!code) return
          event.preventDefault()
          event.stopPropagation()
          submitRef.current(code)
          return
        }

        if (event.key === 'Backspace') {
          event.preventDefault()
          const next = (inputRef.current?.value ?? '').slice(0, -1)
          setValue(next)
          if (inputRef.current) inputRef.current.value = next
          focusInput()
          return
        }

        if (event.key.length === 1) {
          event.preventDefault()
          const next = `${inputRef.current?.value ?? ''}${event.key}`
          setValue(next)
          if (inputRef.current) inputRef.current.value = next
          focusInput()
        }
      }

      window.addEventListener('keydown', onKeyDown, true)
      return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [captureGlobal, enabled, focusInput])

    return (
      <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
        {showToggle && (
          <Button
            type="button"
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={() => onEnabledChange?.(!enabled)}
            title={enabled ? 'Disable barcode scanner' : 'Enable barcode scanner'}
          >
            <Barcode className="mr-2 h-4 w-4" />
            <span className="hidden min-[360px]:inline">{enabled ? 'Scanner On' : 'Barcode scanner'}</span>
            <span className="min-[360px]:hidden">{enabled ? 'On' : 'Scan'}</span>
          </Button>
        )}
        {enabled && (
          <label className="relative min-w-0 flex-1 cursor-text basis-[10rem]">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onMouseDown={() => {
                // Nested overflow:hidden ancestors (POS) cancel native focus in WKWebView.
                requestAnimationFrame(focusInput)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  submit(e.currentTarget.value)
                }
              }}
              placeholder={placeholder}
              className={cn('h-9 pl-9 font-mono text-sm', inputClassName)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              data-barcode-scanner="true"
            />
          </label>
        )}
        {enabled && showToggle && (
          <span className="hidden items-center gap-1 whitespace-nowrap text-sm font-medium text-green-600 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Ready
          </span>
        )}
      </div>
    )
  }
)

export default BarcodeScannerInput
