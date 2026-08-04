'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getCroppedImageBlob } from '@/lib/cropImage'
import { Crop, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageCropModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  onCropComplete: (croppedImage: Blob) => void
  aspectRatio?: number
  circularCrop?: boolean
  outputMaxSize?: number
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  circularCrop = false,
  outputMaxSize = 500,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const onCropChange = useCallback((crop: any) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: any) => {
    setZoom(zoom)
  }, [])

  const onRotationChange = useCallback((rotation: any) => {
    setRotation(rotation)
  }, [])

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCrop = useCallback(async () => {
    if (!croppedAreaPixels) return

    try {
      const blob = await getCroppedImageBlob(
        imageSrc,
        croppedAreaPixels,
        rotation,
        outputMaxSize
      )
      onCropComplete(blob)
      onClose()
    } catch {
      // Crop failed; keep modal open so the user can retry
    }
  }, [croppedAreaPixels, imageSrc, rotation, outputMaxSize, onCropComplete, onClose])

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 1))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        
        <div className="relative h-[400px] w-full bg-gray-100 rounded-lg overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onRotationChange={onRotationChange}
            onCropComplete={onCropCompleteHandler}
            cropShape={circularCrop ? 'round' : 'rect'}
          />
        </div>

        <div className="space-y-4">
          {/* Zoom Slider */}
          <div className="flex items-center gap-4">
            <ZoomOut className="h-4 w-4 text-gray-500" />
            <Slider
              value={[zoom]}
              onValueChange={(value: number[]) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-gray-500" />
          </div>

          {/* Rotation */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Rotation: {rotation}°</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotate}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Rotate 90°
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCrop}>
            <Crop className="mr-2 h-4 w-4" />
            Crop & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
