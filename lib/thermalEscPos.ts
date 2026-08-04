/** Build ESC/POS raster bytes from a logo URL for thermal printers. */

function dotsForWidthMm(widthMm: number): number {
  // ~203 dpi common on 58/80mm printers; keep logos readable but compact.
  const mm = Math.max(25, Math.min(80, widthMm || 58))
  const maxMm = mm <= 42 ? mm * 0.7 : mm * 0.55
  return Math.max(96, Math.min(384, Math.round(maxMm * 8)))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // data: URLs don't need CORS; remote URLs may require it for canvas export.
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load logo image'))
    img.src = src
  })
}

/**
 * Convert a logo image URL to ESC/POS GS v 0 raster command bytes (base64).
 * Returns null if the image cannot be loaded or converted.
 */
export async function logoUrlToEscPosBase64(
  logoUrl: string,
  paperWidthMm = 58
): Promise<string | null> {
  if (!logoUrl?.trim() || typeof document === 'undefined') return null

  try {
    const img = await loadImage(logoUrl.trim())
    const maxW = dotsForWidthMm(paperWidthMm)
    const maxH = Math.round(maxW * 0.45)
    let w = img.naturalWidth || img.width
    let h = img.naturalHeight || img.height
    if (w <= 0 || h <= 0) return null

    const scale = Math.min(maxW / w, maxH / h, 1)
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const { data } = ctx.getImageData(0, 0, w, h)
    const bytesPerRow = Math.ceil(w / 8)
    const raster = new Uint8Array(bytesPerRow * h)

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        const a = data[i + 3]
        if (a < 128) continue
        // Luminance; dark pixels print as black dots.
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        if (lum < 180) {
          raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
        }
      }
    }

    // GS v 0 m xL xH yL yH d1...dk
    const header = new Uint8Array([
      0x1d,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      h & 0xff,
      (h >> 8) & 0xff,
    ])
    const out = new Uint8Array(header.length + raster.length)
    out.set(header, 0)
    out.set(raster, header.length)

    let binary = ''
    for (let i = 0; i < out.length; i += 1) {
      binary += String.fromCharCode(out[i])
    }
    return btoa(binary)
  } catch {
    return null
  }
}

/** Strip thermal control markers for plain-text previews. */
export function stripThermalMarkers(content: string): string {
  return content
    .replace(/@C@/g, '')
    .replace(/@B@/g, '')
    .replace(/@N@/g, '')
}
