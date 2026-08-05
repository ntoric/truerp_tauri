export type ExportProgressState = {
  active: boolean
  label: string
  percent: number
  message: string
  error: string | null
}

type Listener = (state: ExportProgressState) => void

const idleState: ExportProgressState = {
  active: false,
  label: '',
  percent: 0,
  message: '',
  error: null,
}

let state: ExportProgressState = idleState
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener(state))
}

function setState(next: ExportProgressState) {
  state = next
  emit()
}

export function getExportProgress(): ExportProgressState {
  return state
}

export function subscribeExportProgress(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/** Run export work with a shared in-app progress indicator (no system dialogs). */
export async function runWithExportProgress<T>(
  label: string,
  work: (update: (percent: number, message?: string) => void) => Promise<T>
): Promise<T> {
  setState({
    active: true,
    label,
    percent: 0,
    message: 'Starting…',
    error: null,
  })

  const update = (percent: number, message?: string) => {
    setState({
      active: true,
      label,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      message: message ?? state.message,
      error: null,
    })
  }

  try {
    await yieldToUi()
    const result = await work(update)
    setState({
      active: true,
      label,
      percent: 100,
      message: 'Complete',
      error: null,
    })
    await new Promise((resolve) => setTimeout(resolve, 700))
    setState(idleState)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    setState({
      active: true,
      label,
      percent: state.percent,
      message,
      error: message,
    })
    await new Promise((resolve) => setTimeout(resolve, 2200))
    setState(idleState)
    throw err
  }
}
