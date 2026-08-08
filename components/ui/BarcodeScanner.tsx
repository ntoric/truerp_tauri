'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Camera } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '@/hooks/useAuth'
import { isSuperAdmin } from '@/lib/roles'

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
  continuous?: boolean
}

export default function BarcodeScanner({ open, onOpenChange, onScan, continuous = false }: BarcodeScannerProps) {
  const { user } = useAuth()
  const canUseCameraScanner = isSuperAdmin(user?.role)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!canUseCameraScanner) return

    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [open, canUseCameraScanner])

  if (!canUseCameraScanner) {
    return null
  }

  const startScanner = async () => {
    try {
      setError('')
      setIsScanning(true)
      
      // Check if element exists
      const element = document.getElementById('barcode-scanner')
      if (!element) {
        throw new Error('Scanner element not found')
      }

      // Clean up any existing scanner instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop()
          }
          await scannerRef.current.clear()
        } catch (err) {
          console.error('Error cleaning up scanner:', err)
        }
        scannerRef.current = null
      }

      const scanner = new Html5Qrcode('barcode-scanner')
      scannerRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }

      // Try to get available cameras first
      const cameras = await Html5Qrcode.getCameras()
      
      let cameraConfig: any = { facingMode: 'environment' }
      
      // If cameras are available, use the first one (usually back camera)
      if (cameras && cameras.length > 0) {
        cameraConfig = { deviceId: { exact: cameras[0].id } }
      }

      await scanner.start(
        cameraConfig,
        config,
        (decodedText) => {
          onScan(decodedText)
          if (!continuous) {
            stopScanner()
            onOpenChange(false)
          }
        },
        (errorMessage) => {
          // Ignore scanning errors (no barcode in frame)
        }
      )
      
      setIsInitialized(true)
    } catch (err) {
      console.error('Scanner error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to start camera: ${errorMessage}. Please ensure camera permissions are granted and a camera is available.`)
      setIsScanning(false)
      setIsInitialized(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        await scannerRef.current.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      scannerRef.current = null
    }
    setIsScanning(false)
    setIsInitialized(false)
  }

  return (
    <>
      <Dialog open={open && !continuous} onOpenChange={(newOpen) => {
        if (!newOpen) {
          stopScanner()
        }
        onOpenChange(newOpen)
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Scan Barcode
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  stopScanner()
                  onOpenChange(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                {error}
              </div>
            )}
            <div id="barcode-scanner" className="w-full aspect-square bg-black rounded-lg overflow-hidden" />
            {!isInitialized && !error && (
              <p className="text-sm text-gray-500 text-center">
                Initializing camera...
              </p>
            )}
            {isInitialized && (
              <p className="text-sm text-gray-500 text-center">
                Position the barcode within the frame to scan
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {continuous && (
        <div className="fixed bottom-4 right-4 z-50">
          <div id="barcode-scanner" className="w-32 h-32 bg-black rounded-lg overflow-hidden border-2 border-green-500" />
        </div>
      )}
    </>
  )
}
