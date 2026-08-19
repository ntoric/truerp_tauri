'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { KEYBOARD_SHORTCUTS, matchesShortcut } from '@/lib/keyboardShortcuts'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import KeyboardShortcutsPanel from '@/components/keyboard-shortcuts/KeyboardShortcutsPanel'

export interface FormShortcutHandlers {
  onSave?: () => void | Promise<void>
  onSaveAndNew?: () => void | Promise<void>
  onCancel?: () => void
}

interface KeyboardShortcutsContextType {
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  registerFormShortcuts: (handlers: FormShortcutHandlers) => () => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined)

function isTextareaTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isPageEnabled } = usePageFeatures()
  const [panelOpen, setPanelOpen] = useState(false)
  const formHandlersRef = useRef<FormShortcutHandlers>({})
  const altAloneRef = useRef({ pressed: false, usedAsModifier: false })

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => !open)
  }, [])

  const registerFormShortcuts = useCallback((handlers: FormShortcutHandlers) => {
    formHandlersRef.current = handlers
    return () => {
      if (formHandlersRef.current === handlers) {
        formHandlersRef.current = {}
      }
    }
  }, [])

  const navigateTo = useCallback(
    (href: string) => {
      if (!isPageEnabled(href)) return
      router.push(href)
    },
    [isPageEnabled, router]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altAloneRef.current.pressed = true
        altAloneRef.current.usedAsModifier = false
        return
      }

      if (altAloneRef.current.pressed) {
        altAloneRef.current.usedAsModifier = true
      }

      if (event.key === 'Escape' && panelOpen) {
        event.preventDefault()
        setPanelOpen(false)
        return
      }

      const handlers = formHandlersRef.current

      for (const shortcut of KEYBOARD_SHORTCUTS) {
        if (!matchesShortcut(event, shortcut.keys)) continue

        if (shortcut.action === 'form-save' && handlers.onSave) {
          event.preventDefault()
          void handlers.onSave()
          return
        }

        if (shortcut.action === 'form-save-new' && handlers.onSaveAndNew) {
          if (isTextareaTarget(event.target)) return
          event.preventDefault()
          void handlers.onSaveAndNew()
          return
        }

        if (shortcut.action === 'form-cancel' && handlers.onCancel && !panelOpen) {
          const openDialog = document.querySelector('[role="dialog"][data-state="open"]')
          if (openDialog) return
          event.preventDefault()
          handlers.onCancel()
          return
        }

        if (shortcut.action === 'navigate' && shortcut.href) {
          event.preventDefault()
          navigateTo(shortcut.href)
          return
        }

        if (shortcut.action === 'pi-add-item' || shortcut.action === 'pi-add-row' || shortcut.action === 'pi-scan-barcode') {
          if (typeof window !== 'undefined' && window.location.pathname === '/purchase-invoices/create') {
            event.preventDefault()
            window.dispatchEvent(new CustomEvent(`pi-action:${shortcut.action === 'pi-add-item' ? 'add-item' : shortcut.action === 'pi-add-row' ? 'add-row' : 'scan-barcode'}`))
          }
          return
        }
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return
      if (altAloneRef.current.pressed && !altAloneRef.current.usedAsModifier) {
        togglePanel()
      }
      altAloneRef.current.pressed = false
      altAloneRef.current.usedAsModifier = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [navigateTo, panelOpen, togglePanel])

  const value = useMemo(
    () => ({
      panelOpen,
      setPanelOpen,
      togglePanel,
      registerFormShortcuts,
    }),
    [panelOpen, togglePanel, registerFormShortcuts]
  )

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        shortcuts={KEYBOARD_SHORTCUTS}
      />
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider')
  }
  return context
}
