'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import ImageCropModal from '@/components/ImageCropModal'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { blobToDataUrl } from '@/lib/cropImage'
import { notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'

interface GalleryImage {
  id: string
  image_url: string
}

interface Props {
  product: { product_id: string; name: string } | null
  onClose: () => void
  /** Called after any change so the catalogue thumbnail can refresh. */
  onChanged: () => void
}

const MAX_EDGE = 1024

// Downscale a picked file to a JPEG data URL (used when several files are
// added at once, skipping the cropper).
async function fileToResizedDataUrl(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not read image'))
    el.src = src
  })
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export default function ProductImagesDialog({ product, onClose, onChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mainImage, setMainImage] = useState('')
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cropSource, setCropSource] = useState('')

  const productId = product?.product_id

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const res = await apiFetch(`/b2b-shop/catalog/${productId}/images`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load images')
      setMainImage(data.main_image || '')
      setGallery(data.images || [])
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (productId) {
      setMainImage('')
      setGallery([])
      load()
    }
  }, [productId, load])

  const request = async (path: string, init: RequestInit) => {
    const res = await apiFetch(path, init)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Request failed')
    }
  }
  const setMain = (url: string) =>
    request(`/b2b-shop/catalog/${productId}/image`, { method: 'PUT', body: JSON.stringify({ image_url: url }) })
  const addToGallery = (url: string) =>
    request(`/products/${productId}/images`, { method: 'POST', body: JSON.stringify({ image_url: url }) })
  const deleteFromGallery = (id: string) => request(`/product-images/${id}`, { method: 'DELETE' })

  // Runs a change, then reloads the dialog and the catalogue.
  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true)
    try {
      await action()
      if (success) notifySuccess(success)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to update images')
    } finally {
      setBusy(false)
      await load()
      onChanged()
    }
  }

  // The first picture becomes the main image; later ones join the gallery.
  const addImages = (urls: string[]) =>
    run(async () => {
      let hasMain = !!mainImage
      for (const url of urls) {
        if (!hasMain) {
          await setMain(url)
          hasMain = true
        } else {
          await addToGallery(url)
        }
      }
    }, urls.length === 1 ? 'Image added' : `${urls.length} images added`)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (files.length === 0) return
    if (files.length === 1) {
      // Single picture: let the user crop it first.
      const reader = new FileReader()
      reader.onload = () => setCropSource(reader.result as string)
      reader.readAsDataURL(files[0])
      return
    }
    try {
      addImages(await Promise.all(files.map(fileToResizedDataUrl)))
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not read images')
    }
  }

  const makeMain = (img: GalleryImage) =>
    run(async () => {
      const previous = mainImage
      await setMain(img.image_url)
      await deleteFromGallery(img.id)
      if (previous) await addToGallery(previous)
    }, 'Main image updated')

  // Removing the main image promotes the first gallery picture, if any.
  const removeMain = () =>
    run(async () => {
      const next = gallery[0]
      await setMain(next ? next.image_url : '')
      if (next) await deleteFromGallery(next.id)
    }, 'Image removed')

  const removeGalleryImage = (img: GalleryImage) => run(() => deleteFromGallery(img.id), 'Image removed')

  const total = (mainImage ? 1 : 0) + gallery.length

  return (
    <>
      <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Product images</DialogTitle>
            <DialogDescription>
              {product?.name} · The main image is shown first in your shop; buyers can browse the rest on the product page.
            </DialogDescription>
          </DialogHeader>

          {loading && total === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {mainImage && (
                <ImageTile src={mainImage} name={product?.name ?? ''} isMain disabled={busy} onRemove={removeMain} />
              )}
              {gallery.map((img) => (
                <ImageTile
                  key={img.id}
                  src={img.image_url}
                  name={product?.name ?? ''}
                  disabled={busy}
                  onMakeMain={() => makeMain(img)}
                  onRemove={() => removeGalleryImage(img)}
                />
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                {total === 0 ? 'Add image' : 'Add more'}
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            JPG or PNG. Pick one file to crop it, or several to add them all at once (resized to {MAX_EDGE}px).
          </p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        </DialogContent>
      </Dialog>

      {cropSource && (
        <ImageCropModal
          isOpen={!!cropSource}
          onClose={() => setCropSource('')}
          imageSrc={cropSource}
          aspectRatio={1}
          outputMaxSize={MAX_EDGE}
          onCropComplete={async (blob) => {
            setCropSource('')
            addImages([await blobToDataUrl(blob)])
          }}
        />
      )}
    </>
  )
}

function ImageTile({
  src,
  name,
  isMain,
  disabled,
  onMakeMain,
  onRemove,
}: {
  src: string
  name: string
  isMain?: boolean
  disabled: boolean
  onMakeMain?: () => void
  onRemove: () => void
}) {
  return (
    <div className={cn('group relative aspect-square overflow-hidden rounded-lg border bg-slate-50', isMain && 'ring-2 ring-primary')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} className="h-full w-full object-cover" />
      {isMain && (
        <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
          Main
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {onMakeMain && (
          <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={disabled} onClick={onMakeMain}>
            <Star className="mr-1 h-3.5 w-3.5" /> Main
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 w-7 p-0 text-rose-600"
          disabled={disabled}
          onClick={onRemove}
          aria-label="Remove image"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
