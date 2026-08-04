'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  checkDesktopForUpdates,
  downloadAndInstallDesktopUpdate,
  getDesktopAppVersion,
  hasDesktopUpdater,
  type DesktopUpdateCheckResult,
} from '@/lib/desktopBridge'
import { Download, Loader2, RefreshCw } from 'lucide-react'

export default function DesktopUpdatesCard() {
  const [visible, setVisible] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [result, setResult] = useState<DesktopUpdateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasDesktopUpdater()) return
    setVisible(true)
    void getDesktopAppVersion().then((v) => {
      if (v) setVersion(v)
    })
  }, [])

  if (!visible) return null

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
    if (
      !confirm(
        `Download and install TruERP ${result.version || ''}? The app will restart when finished.`
      )
    ) {
      return
    }
    setInstalling(true)
    setError(null)
    try {
      await downloadAndInstallDesktopUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install update')
      setInstalling(false)
    }
  }

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

        {result && !result.available && !error && (
          <p className="text-sm text-muted-foreground">You are on the latest version.</p>
        )}
        {result?.available && result.notes && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.notes}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
