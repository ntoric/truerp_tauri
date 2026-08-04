'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import {
  convertScaleWeightToProductQuantity,
  isWebSerialSupported,
  mergeWeighingScaleSettings,
  normalizeScaleWeightKg,
  parseWeightFromScaleLine,
  roundWeight,
  type WeighingScaleSettings,
} from '@/lib/weighingScale'

export type WeighingScaleConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unsupported'

export function useWeighingScale() {
  const [settings, setSettings] = useState<WeighingScaleSettings>(
    mergeWeighingScaleSettings(null)
  )
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [connectionStatus, setConnectionStatus] =
    useState<WeighingScaleConnectionStatus>('disconnected')
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null)
  const [isStable, setIsStable] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const serialBufferRef = useRef('')
  const keyboardBufferRef = useRef('')
  const stableCounterRef = useRef(0)
  const lastReadingRef = useRef<number | null>(null)
  const abortSerialRef = useRef(false)

  const applyReading = useCallback(
    (rawWeight: number | null) => {
      if (rawWeight === null || !Number.isFinite(rawWeight)) return

      const weightKg = normalizeScaleWeightKg(
        rawWeight,
        settings.scale_weight_unit,
        settings.tare_weight
      )

      if (weightKg < settings.min_weight) {
        setCurrentWeightKg(null)
        setIsStable(false)
        stableCounterRef.current = 0
        lastReadingRef.current = null
        return
      }

      const rounded = roundWeight(weightKg, settings.decimal_places)
      setCurrentWeightKg(rounded)

      if (
        lastReadingRef.current !== null &&
        Math.abs(lastReadingRef.current - rounded) <
          1 / 10 ** Math.max(settings.decimal_places, 1)
      ) {
        stableCounterRef.current += 1
      } else {
        stableCounterRef.current = 1
      }
      lastReadingRef.current = rounded
      setIsStable(stableCounterRef.current >= settings.stable_readings_required)
    },
    [settings]
  )

  const handleScaleLine = useCallback(
    (line: string) => {
      const parsed = parseWeightFromScaleLine(line, settings.protocol)
      applyReading(parsed)
    },
    [applyReading, settings.protocol]
  )

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/settings/weighing-scale')
      if (res.ok) {
        const data = await res.json()
        setSettings(mergeWeighingScaleSettings(data))
      }
    } catch {
      /* use defaults when offline */
    } finally {
      setSettingsLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const disconnect = useCallback(async () => {
    abortSerialRef.current = true
    try {
      await readerRef.current?.cancel()
    } catch {
      /* ignore */
    }
    readerRef.current = null
    try {
      await portRef.current?.close()
    } catch {
      /* ignore */
    }
    portRef.current = null
    serialBufferRef.current = ''
    setConnectionStatus('disconnected')
  }, [])

  const readSerialLoop = useCallback(
    async (port: SerialPort) => {
      if (!port.readable) return
      const reader = port.readable.getReader()
      readerRef.current = reader
      abortSerialRef.current = false

      try {
        while (!abortSerialRef.current) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue

          serialBufferRef.current += new TextDecoder().decode(value)
          const parts = serialBufferRef.current.split(/\r\n|\n|\r/)
          serialBufferRef.current = parts.pop() ?? ''
          for (const part of parts) {
            handleScaleLine(part)
          }
        }
      } catch (err) {
        if (!abortSerialRef.current) {
          setLastError(err instanceof Error ? err.message : 'Serial read failed')
          setConnectionStatus('disconnected')
        }
      } finally {
        reader.releaseLock()
        readerRef.current = null
      }
    },
    [handleScaleLine]
  )

  const connect = useCallback(async () => {
    setLastError(null)

    if (!settings.enabled) {
      setLastError('Enable weighing scale in Settings first')
      return
    }

    if (settings.connection === 'keyboard') {
      setConnectionStatus('connected')
      return
    }

    if (!isWebSerialSupported()) {
      setConnectionStatus('unsupported')
      setLastError(
        'Web Serial is not available. Use Chrome or Edge, or switch to Keyboard (HID) mode.'
      )
      return
    }

    setConnectionStatus('connecting')

    try {
      await disconnect()

      const ports = await navigator.serial!.getPorts()
      let port = ports[0]
      if (!port) {
        port = await navigator.serial!.requestPort()
      }

      await port.open({
        baudRate: settings.baud_rate,
        dataBits: settings.data_bits,
        stopBits: settings.stop_bits,
        parity: settings.parity,
      })

      portRef.current = port
      setConnectionStatus('connected')
      void readSerialLoop(port)
    } catch (err) {
      setConnectionStatus('disconnected')
      setLastError(err instanceof Error ? err.message : 'Failed to connect to scale')
    }
  }, [disconnect, readSerialLoop, settings])

  useEffect(() => {
    if (!settings.enabled || settings.connection !== 'keyboard') return
    if (connectionStatus !== 'connected') return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === 'Enter') {
        const line = keyboardBufferRef.current.trim()
        keyboardBufferRef.current = ''
        if (line) handleScaleLine(line)
        return
      }

      if (event.key.length === 1) {
        keyboardBufferRef.current += event.key
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [connectionStatus, handleScaleLine, settings.connection, settings.enabled])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  useEffect(() => {
    if (!settings.enabled) {
      void disconnect()
    }
  }, [disconnect, settings.enabled])

  const getCapturedWeightKg = useCallback((): number | null => {
    if (currentWeightKg === null) return null
    if (settings.require_stable_weight && !isStable) return null
    return currentWeightKg
  }, [currentWeightKg, isStable, settings.require_stable_weight])

  const getQuantityForProduct = useCallback(
    (productUnit: string): number | null => {
      const weightKg = getCapturedWeightKg()
      if (weightKg === null) return null
      return convertScaleWeightToProductQuantity(
        weightKg,
        productUnit,
        settings.decimal_places
      )
    },
    [getCapturedWeightKg, settings.decimal_places]
  )

  return {
    settings,
    settingsLoaded,
    setSettings,
    loadSettings,
    connectionStatus,
    currentWeightKg,
    isStable,
    lastError,
    connect,
    disconnect,
    getCapturedWeightKg,
    getQuantityForProduct,
    isSupported: isWebSerialSupported(),
  }
}
