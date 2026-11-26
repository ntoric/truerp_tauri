'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, Clipboard, Crop, ImagePlus, Link2, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import ImageCropModal from '@/components/ImageCropModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { blobToDataUrl } from '@/lib/cropImage'
import { cn } from '@/lib/utils'

interface ProductImageFieldProps {
  value: string
  onChange: (imageUrl: string) => void
  idPrefix?: string
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_MB = 10
const OUTPUT_SIZES = [256, 512, 768, 1024] as const

/** Approximate byte size of a data URL's payload, for the preview meta line. */
function dataUrlBytes(url: string): number | null {
  if (!url.startsWith('data:')) return null
  const comma = url.indexOf(',')
  if (comma < 0) return null
  const b64 = url.slice(comma + 1)
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Product image picker: drag & drop, click, keyboard or paste (Ctrl/⌘+V) an
 * image, then crop it to a square at the chosen output size. A URL can be
 * used instead. The value is a data URL (uploaded) or a remote URL.
 */
export default function ProductImageField({ value, onChange, idPrefix = 'product-image' }: ProductImageFieldProps) {
  const autoId = useId()
  const baseId = `${idPrefix}-${autoId.replace(/:/g, '')}`
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragDepth = useRef(0)

  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [cropSource, setCropSource] = useState('')
  const [outputMaxSize, setOutputMaxSize] = useState<number>(512)
  const [showUrl, setShowUrl] = useState(() => !!value && !value.startsWith('data:'))
  const [previewFailed, setPreviewFailed] = useState(false)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  // Resolved after mount so server and client markup match.
  const [isMac, setIsMac] = useState(false)
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), [])

  useEffect(() => {
    setPreviewFailed(false)
    setDims(null)
  }, [value])

  const openFile = useCallback((file: File | null | undefined) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Use a JPG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That image is ${formatBytes(file.size)}. Choose one under ${MAX_FILE_MB} MB.`)
      return
    }
    setError('')
    setReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      setReading(false)
      setCropSource(reader.result as string)
    }
    reader.onerror = () => {
      setReading(false)
      setError('Could not read that file. Try another image.')
    }
    reader.readAsDataURL(file)
  }, [])

  const browse = () => fileInputRef.current?.click()

  // Paste an image from the clipboard while this field is on screen. Ignores
  // clipboards without an image, so normal text pasting elsewhere is untouched.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (cropSource || !rootRef.current || rootRef.current.offsetParent === null) return
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      if (!item) return
      e.preventDefault()
      openFile(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [cropSource, openFile])

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) return openFile(file)
      // An image dragged from another browser tab arrives as a URL.
      const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')).trim().split('\n')[0]
      if (/^https?:\/\//i.test(url)) {
        setError('')
        setShowUrl(true)
        onChange(url)
      } else {
        setError('Drop an image file (JPG, PNG or WebP).')
      }
    },
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    onChange(await blobToDataUrl(croppedBlob))
    setCropSource('')
  }

  const bytes = dataUrlBytes(value)
  const urlValue = value.startsWith('data:') ? '' : value

  return (
    <div ref={rootRef} className="space-y-4">
      <input
        ref={fileInputRef}
        id={`${baseId}-file`}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          openFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {value && !previewFailed ? (
        /* ---------------- Preview ---------------- */
        <div
          {...dragHandlers}
          className={cn(
            'relative flex flex-col gap-4 rounded-2xl border bg-card p-3 transition-colors sm:flex-row sm:items-center sm:p-4',
            dragging ? 'border-primary bg-tint' : 'border-border'
          )}
        >
          <div className="group relative h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-[conic-gradient(#f4f4f5_25%,#fff_0_50%,#f4f4f5_0_75%,#fff_0)] bg-[length:16px_16px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Product image preview"
              className="h-full w-full object-cover"
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setPreviewFailed(true)}
            />
            <button
              type="button"
              onClick={() => setCropSource(value)}
              className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 text-sm font-medium text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Crop className="h-4 w-4" /> Crop & resize
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-heading">
                {value.startsWith('data:') ? 'Uploaded image' : 'Image from URL'}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[dims && `${dims.w} × ${dims.h}px`, bytes !== null && formatBytes(bytes), !value.startsWith('data:') && value]
                  .filter(Boolean)
                  .join(' · ') || 'Loading…'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={browse}>
                <RefreshCw className="h-3.5 w-3.5" /> Replace
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setCropSource(value)}>
                <Crop className="h-3.5 w-3.5" /> Crop & resize
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange('')
                  setError('')
                }}
                className="text-destructive hover:bg-[hsl(var(--destructive)/0.08)] hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Drop another image here to replace it.</p>
          </div>

          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-card/80 text-sm font-medium text-primary backdrop-blur-[1px]">
              <UploadCloud className="mr-2 h-5 w-5" /> Drop to replace
            </div>
          )}
        </div>
      ) : (
        /* ---------------- Drop zone ---------------- */
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload product image: drop a file, press Enter to browse, or paste an image"
          aria-describedby={`${baseId}-hint`}
          onClick={browse}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              browse()
            }
          }}
          {...dragHandlers}
          className={cn(
            'group relative flex min-h-[13rem] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-8 text-center outline-none transition-all duration-200',
            dragging
              ? 'scale-[1.01] border-primary bg-tint shadow-gr-accent'
              : 'border-input bg-surface-2 hover:border-primary/60 hover:bg-tint/60 focus-visible:border-primary',
            error && !dragging && 'border-destructive/60'
          )}
        >
          {/* soft ring watermark */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[24px] border-primary/[0.05]"
          />
          <span
            className={cn(
              'relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200',
              dragging
                ? '-translate-y-1 bg-button-gradient text-primary-foreground shadow-gr-accent'
                : 'bg-card text-primary shadow-gr-sm group-hover:-translate-y-0.5'
            )}
          >
            {reading ? <Loader2 className="h-6 w-6 animate-spin" /> : dragging ? <UploadCloud className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
          </span>
          <div className="relative space-y-1">
            <p className="text-[15px] font-medium text-heading">
              {dragging ? 'Drop to upload' : reading ? 'Reading image…' : (
                <>
                  Drag & drop an image, or <span className="text-primary underline-offset-2 group-hover:underline">browse</span>
                </>
              )}
            </p>
            <p id={`${baseId}-hint`} className="text-xs text-muted-foreground">
              JPG, PNG or WebP · up to {MAX_FILE_MB} MB · you can crop, zoom and rotate next
            </p>
          </div>
          <span className="relative hidden items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border sm:inline-flex">
            <Clipboard className="h-3 w-3" /> or paste with
            <kbd className="rounded bg-surface-2 px-1.5 py-px font-sans text-[10px] font-medium text-heading ring-1 ring-border">
              {isMac ? '⌘' : 'Ctrl'} V
            </kbd>
          </span>
        </div>
      )}

      {(error || (value && previewFailed)) && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error || 'This image could not be loaded. Check the URL, or upload a file instead.'}
        </p>
      )}

      {/* ---------------- Output size + URL ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${baseId}-size`} className="text-xs font-medium text-heading">
            Output size
          </span>
          <div role="radiogroup" aria-labelledby={`${baseId}-size`} className="inline-flex rounded-full border border-border bg-surface-2 p-0.5">
            {OUTPUT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={outputMaxSize === size}
                onClick={() => setOutputMaxSize(size)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors',
                  outputMaxSize === size ? 'bg-card text-primary shadow-gr-xs' : 'text-muted-foreground hover:text-heading'
                )}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>
        {!showUrl && (
          <button
            type="button"
            onClick={() => setShowUrl(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Link2 className="h-3.5 w-3.5" /> Use an image URL instead
          </button>
        )}
      </div>

      {showUrl && (
        <div className="space-y-1.5">
          <label htmlFor={`${baseId}-url`} className="text-xs font-medium text-heading">
            Image URL
          </label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${baseId}-url`}
              value={urlValue}
              onChange={(e) => {
                setError('')
                onChange(e.target.value.trim())
              }}
              placeholder="https://example.com/product.jpg"
              className="pl-9"
              inputMode="url"
            />
          </div>
        </div>
      )}

      {cropSource && (
        <ImageCropModal
          isOpen
          onClose={() => setCropSource('')}
          imageSrc={cropSource}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          outputMaxSize={outputMaxSize}
        />
      )}
    </div>
  )
}
