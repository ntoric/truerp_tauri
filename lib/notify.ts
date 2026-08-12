import { toast } from '@/hooks/use-toast'

export type NotifyOptions = {
  /** Overrides the standard category title (Success / Error / …). */
  title?: string
  /** Optional extra detail under the main message. */
  description?: string
}

/**
 * App toast standard:
 * - Always uses the shared toaster card (icon + category title + message)
 * - Prefer these helpers over calling `toast()` / `useToast()` directly
 */
function notify(
  variant: 'default' | 'info' | 'success' | 'warning' | 'destructive',
  message: string,
  defaultTitle: string,
  options?: NotifyOptions
) {
  const title = options?.title ?? defaultTitle
  const description = options?.description ?? message
  toast({
    title,
    description,
    variant,
  })
}

/** Show a user-friendly error toast. */
export function notifyError(message: string, titleOrOptions: string | NotifyOptions = 'Error') {
  const safeMessage = message || 'Something went wrong. Please try again.'
  if (typeof titleOrOptions === 'string') {
    notify('destructive', safeMessage, titleOrOptions)
    return
  }
  notify('destructive', safeMessage, 'Error', titleOrOptions)
}

/** Show a success toast. */
export function notifySuccess(message: string, titleOrOptions: string | NotifyOptions = 'Success') {
  if (typeof titleOrOptions === 'string') {
    notify('success', message, titleOrOptions)
    return
  }
  notify('success', message, 'Success', titleOrOptions)
}

/** Show an info toast. */
export function notifyInfo(message: string, titleOrOptions: string | NotifyOptions = 'Info') {
  if (typeof titleOrOptions === 'string') {
    notify('info', message, titleOrOptions)
    return
  }
  notify('info', message, 'Info', titleOrOptions)
}

/** Show a warning toast. */
export function notifyWarning(message: string, titleOrOptions: string | NotifyOptions = 'Warning') {
  if (typeof titleOrOptions === 'string') {
    notify('warning', message, titleOrOptions)
    return
  }
  notify('warning', message, 'Warning', titleOrOptions)
}
