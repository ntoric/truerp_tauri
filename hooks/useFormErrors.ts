'use client'

import { useCallback, useState } from 'react'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  FieldErrors,
  firstFieldError,
  parseApiError,
} from '@/lib/form-errors'

export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const clearErrors = useCallback(() => setFieldErrors({}), [])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const setError = useCallback((field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }))
  }, [])

  const showErrorToast = useCallback((message: string, title = 'Error') => {
    notifyError(message, title)
  }, [])

  const showSuccessToast = useCallback((message: string, title = 'Success') => {
    notifySuccess(message, title)
  }, [])

  const handleApiError = useCallback(
    async (res: Response, options?: { toastTitle?: string; switchTab?: (field: string) => void }) => {
      const { message, fields } = await parseApiError(res)
      setFieldErrors(fields)
      showErrorToast(message, options?.toastTitle || 'Unable to save')
      const first = firstFieldError(fields)
      if (first && options?.switchTab) options.switchTab(first)
      return { message, fields }
    },
    [showErrorToast]
  )

  const validateRequired = useCallback(
    (values: Record<string, unknown>, required: Record<string, string>) => {
      const next: FieldErrors = {}
      for (const [field, label] of Object.entries(required)) {
        const value = values[field]
        const empty =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && !value.trim()) ||
          (typeof value === 'number' && Number.isNaN(value))
        if (empty) next[field] = `${label} is required`
      }
      setFieldErrors(next)
      if (Object.keys(next).length > 0) {
        const first = Object.values(next)[0]
        showErrorToast(first, 'Missing required fields')
        return false
      }
      return true
    },
    [showErrorToast]
  )

  return {
    fieldErrors,
    setFieldErrors,
    clearErrors,
    clearFieldError,
    setError,
    showErrorToast,
    showSuccessToast,
    handleApiError,
    validateRequired,
  }
}
