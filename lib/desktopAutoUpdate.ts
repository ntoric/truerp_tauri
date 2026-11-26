import {
  checkDesktopForUpdates,
  downloadAndInstallDesktopUpdate,
  hasDesktopUpdater,
  setDesktopForceUpdate,
  subscribeDesktopUpdateProgress,
} from './desktopBridge'
import { notifyError, notifyInfo } from './notify'

// One forced install attempt per store per app session — refreshStores() can
// run again after mutations without re-triggering the download.
const forcedUpdateAttempted = new Set<string>()

/**
 * Applies the store's "force update" policy on the desktop shell:
 * - always reports the flag to the native shell so its startup prompt stays in
 *   sync (suppressed while forced — the UI owns the install),
 * - when enabled, silently checks once per session and, if an update exists,
 *   downloads and installs it automatically (the app restarts on completion).
 * No-op in browsers and on shells without the updater.
 */
export function applyStoreForceUpdatePolicy(
  store: { id: string; name?: string; force_update?: boolean } | null | undefined
) {
  if (!hasDesktopUpdater()) return

  const enabled = !!store?.force_update && !!store?.id
  if (!enabled) {
    void setDesktopForceUpdate(false)
    return
  }

  const storeId = store.id
  const storeName = store.name?.trim() || 'this store'
  if (forcedUpdateAttempted.has(storeId)) return
  forcedUpdateAttempted.add(storeId)

  void runForcedUpdate(storeName)
}

async function runForcedUpdate(storeName: string) {
  try {
    await setDesktopForceUpdate(true)

    const result = await checkDesktopForUpdates()
    if (!result?.available) return

    notifyInfo(
      `TruERP ${result.version || 'update'} is downloading for ${storeName}. The app will restart automatically when it is ready.`,
      'Software update'
    )

    let installingNotified = false
    const unlisten = await subscribeDesktopUpdateProgress((progress) => {
      if (progress.status === 'installing' && !installingNotified) {
        installingNotified = true
        notifyInfo('Installing update — the app will restart in a moment.', 'Software update')
      }
    })

    try {
      await downloadAndInstallDesktopUpdate()
    } finally {
      unlisten()
    }
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : 'The automatic update failed.'
    notifyError(message, { title: 'Software update', description: `Automatic update for ${storeName} failed.` })
  }
}
