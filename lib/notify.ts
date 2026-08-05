import { toast } from '@/hooks/use-toast'

/** Show a user-friendly error toast (replaces alert for failures). */
export function notifyError(message: string, title = 'Error') {
  toast({
    title,
    description: message || 'Something went wrong. Please try again.',
    variant: 'destructive',
  })
}

/** Show a success toast. */
export function notifySuccess(message: string, title = 'Success') {
  toast({
    title,
    description: message,
    variant: 'success',
  })
}

/** Show an info toast. */
export function notifyInfo(message: string, title = 'Info') {
  toast({
    title,
    description: message,
    variant: 'info',
  })
}

/** Show a warning toast. */
export function notifyWarning(message: string, title = 'Warning') {
  toast({
    title,
    description: message,
    variant: 'warning',
  })
}
