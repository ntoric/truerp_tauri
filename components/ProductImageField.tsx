'use client'

import { useRef, useState } from 'react'
import ImageCropModal from '@/components/ImageCropModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { blobToDataUrl } from '@/lib/cropImage'
import { Crop, Trash2, Upload } from 'lucide-react'

interface ProductImageFieldProps {
  value: string
  onChange: (imageUrl: string) => void
  idPrefix?: string
}

const OUTPUT_SIZE_MIN = 256
const OUTPUT_SIZE_MAX = 1024
const OUTPUT_SIZE_STEP = 64

export default function ProductImageField({
  value,
  onChange,
  idPrefix = 'product-image',
}: ProductImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropSource, setCropSource] = useState('')
  const [showCropModal, setShowCropModal] = useState(false)
  const [outputMaxSize, setOutputMaxSize] = useState(512)

  const openCropper = (src: string) => {
    setCropSource(src)
    setShowCropModal(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      openCropper(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    const dataUrl = await blobToDataUrl(croppedBlob)
    onChange(dataUrl)
    setShowCropModal(false)
    setCropSource('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-file`}>Upload image</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            ref={fileInputRef}
            id={`${idPrefix}-file`}
            type="file"
            accept="image/*"
            className="max-w-sm"
            onChange={handleFileSelect}
          />
          {value && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => openCropper(value)}>
                <Crop className="mr-2 h-4 w-4" />
                Crop & resize
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange('')}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500">
          JPG or PNG. After upload you can crop, zoom, rotate, and choose output size.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Output size (max edge): {outputMaxSize}px</Label>
        <Slider
          value={[outputMaxSize]}
          onValueChange={(v) => setOutputMaxSize(v[0])}
          min={OUTPUT_SIZE_MIN}
          max={OUTPUT_SIZE_MAX}
          step={OUTPUT_SIZE_STEP}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-url`}>Or paste image URL</Label>
        <Input
          id={`${idPrefix}-url`}
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
        />
      </div>

      {value ? (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Preview</p>
          <img
            src={value}
            alt="Product preview"
            className="h-40 w-40 rounded-md border object-cover bg-white"
          />
        </div>
      ) : (
        <div className="flex h-40 w-full max-w-xs flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50 text-center text-sm text-gray-500">
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          No image yet
        </div>
      )}

      {showCropModal && cropSource && (
        <ImageCropModal
          isOpen={showCropModal}
          onClose={() => {
            setShowCropModal(false)
            setCropSource('')
          }}
          imageSrc={cropSource}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          outputMaxSize={outputMaxSize}
        />
      )}
    </div>
  )
}
