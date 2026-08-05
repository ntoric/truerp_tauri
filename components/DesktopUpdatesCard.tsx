'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  checkDesktopForUpdates,
  downloadAndInstallDesktopUpdate,
  getDesktopAppVersion,
  hasDesktopUpdater,
  subscribeDesktopUpdateProgress,
  type DesktopUpdateCheckResult,
  type DesktopUpdateProgress,
} from '@/lib/desktopBridge'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export default function DesktopUpdatesCard() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [visible, setVisible] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<DesktopUpdateProgress | null>(null)
  const [result, setResult] = useState<DesktopUpdateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasDesktopUpdater()) return
    setVisible(true)
    void getDesktopAppVersion().then((v) => {
      if (v) setVersion(v)
    })
  }, [])

  useEffect(() => {
    if (!visible) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    void subscribeDesktopUpdateProgress((next) => {
      if (!cancelled) setProgress(next)
    }).then((fn) => {
      if (cancelled) {
        fn()
        return
      }
      unlisten = fn
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [visible])

  const onCheck = async () => {
    setChecking(true)
    setError(null)
    setResult(null)
    try {
      const next = await checkDesktopForUpdates()
      if (!next) {
        setError('Updater is not available in this build.')
        return
      }
      setResult(next)
      if (next.currentVersion) setVersion(next.currentVersion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates')
    } finally {
      setChecking(false)
    }
  }

  const onInstall = async () => {
    if (!result?.available) return
    if (!(await confirm({
      title: `Install TruERP ${result.version || ''}?`,
      description: 'Download and install this update? The app will restart when finished.',
      confirmLabel: 'Install',
      variant: 'default',
    }))) return
    setInstalling(true)
    setProgress({ status: 'downloading', downloaded: 0, contentLength: null, percent: null })
    setError(null)
    try {
      await downloadAndInstallDesktopUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install update')
      setInstalling(false)
      setProgress(null)
    }
  }

  if (!visible) return null

  const percent =
    progress?.percent != null && Number.isFinite(progress.percent)
      ? Math.max(0, Math.min(100, progress.percent))
      : null
  const progressLabel =
    progress?.status === 'installing'
      ? 'Installing update…'
      : percent != null
        ? `Downloading update… ${Math.round(percent)}%`
        : 'Downloading update…'
  const sizeLabel =
    progress && progress.status === 'downloading'
      ? progress.contentLength
        ? `${formatBytes(progress.downloaded)} of ${formatBytes(progress.contentLength)}`
        : progress.downloaded > 0
          ? formatBytes(progress.downloaded)
          : null
      : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Download className="h-5 w-5 text-blue-600" />
        <CardTitle>Desktop Updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Current version: <span className="font-medium text-foreground">{version || '…'}</span>
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCheck} disabled={checking || installing}>
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Check for updates
          </Button>
          {result?.available && (
            <Button type="button" onClick={onInstall} disabled={installing || checking}>
              {installing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Install {result.version}
            </Button>
          )}
        </div>

        {installing && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{progressLabel}</span>
              {sizeLabel && <span className="text-muted-foreground tabular-nums">{sizeLabel}</span>}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              {percent != null ? (
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/80" />
              )}
            </div>
            {progress?.status === 'installing' && (
              <p className="text-xs text-muted-foreground">The app will restart when installation finishes.</p>
            )}
          </div>
        )}

        {result && !result.available && !error && (
          <p className="text-sm text-muted-foreground">You are on the latest version.</p>
        )}
        {result?.available && result.notes && !installing && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.notes}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      {confirmDialog}
    </Card>
  )
}
