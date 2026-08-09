'use client'

import { useEffect, useRef } from 'react'
import { useKeyboardShortcuts, type FormShortcutHandlers } from '@/hooks/useKeyboardShortcuts'

/** Register page-level Save / Save & New / Cancel handlers for global keyboard shortcuts. */
export function useFormKeyboardShortcuts(handlers: FormShortcutHandlers) {
  const { registerFormShortcuts } = useKeyboardShortcuts()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    return registerFormShortcuts({
      onSave: () => handlersRef.current.onSave?.(),
      onSaveAndNew: () => handlersRef.current.onSaveAndNew?.(),
      onCancel: () => handlersRef.current.onCancel?.(),
    })
  }, [registerFormShortcuts])
}
