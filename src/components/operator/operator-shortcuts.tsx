'use client'

/**
 * Global operator shortcuts.
 *
 * Day-2 polish: power users move fast. Keyboard provider mounted once
 * inside the app shell.
 *
 *   /        focus the global search box (jump-to-page input)
 *   ?        toggle the shortcuts help modal
 *   Esc      close any open modal / dialog / overlay
 *   A        approve the focused approval row (when context = approvals)
 *   R        reject the focused approval row (when context = approvals)
 *   J / K    next / previous focusable approval row
 *
 * Listeners are skipped when the focus is inside a text input, textarea,
 * select, or [contenteditable] element — so typing into chat / search
 * never triggers them.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface ShortcutsContextValue {
  showHelp: boolean
  setShowHelp: (v: boolean) => void
  /** Components in approval contexts register handlers so global hotkeys can act on the selected row. */
  registerApprovalContext: (handlers: ApprovalHandlers | null) => void
}

interface ApprovalHandlers {
  approveFocused: () => void
  rejectFocused: () => void
  moveSelection: (direction: 1 | -1) => void
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

export function OperatorShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false)
  const approvalHandlersRef = useRef<ApprovalHandlers | null>(null)

  const registerApprovalContext = useCallback((h: ApprovalHandlers | null) => {
    approvalHandlersRef.current = h
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return
      // Allow modifier-free single-key shortcuts only — preserve OS combos.
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case '?': {
          e.preventDefault()
          setShowHelp((v) => !v)
          return
        }
        case '/': {
          // The header already binds `/` to its command palette opener.
          // Leave that handler to win — we only document the shortcut.
          return
        }
        case 'Escape': {
          if (showHelp) {
            setShowHelp(false)
            return
          }
          // Close any visible modal that exposes a close action.
          const modalClose =
            document.querySelector<HTMLButtonElement>('[data-testid$="-modal"] button[aria-label="Close"]') ||
            document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]')
          if (modalClose) {
            modalClose.click()
          }
          return
        }
        case 'a':
        case 'A': {
          if (approvalHandlersRef.current) {
            e.preventDefault()
            approvalHandlersRef.current.approveFocused()
          }
          return
        }
        case 'r':
        case 'R': {
          if (approvalHandlersRef.current) {
            e.preventDefault()
            approvalHandlersRef.current.rejectFocused()
          }
          return
        }
        case 'j':
        case 'J': {
          if (approvalHandlersRef.current) {
            e.preventDefault()
            approvalHandlersRef.current.moveSelection(1)
          }
          return
        }
        case 'k':
        case 'K': {
          if (approvalHandlersRef.current) {
            e.preventDefault()
            approvalHandlersRef.current.moveSelection(-1)
          }
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHelp])

  const value = useMemo<ShortcutsContextValue>(
    () => ({ showHelp, setShowHelp, registerApprovalContext }),
    [showHelp, registerApprovalContext],
  )

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      {showHelp && <ShortcutsHelpModal onClose={() => setShowHelp(false)} />}
    </ShortcutsContext.Provider>
  )
}

export function useOperatorShortcuts(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext)
  if (!ctx) {
    return {
      showHelp: false,
      setShowHelp: () => {},
      registerApprovalContext: () => {},
    }
  }
  return ctx
}

function ShortcutsHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-testid="shortcuts-help-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0f0f17] overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">Keyboard shortcuts</p>
            <p className="text-sm text-white/85">Move fast, supervise faster.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-md bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
          >
            ×
          </button>
        </header>
        <div className="p-5">
          <table className="w-full text-sm">
            <tbody>
              {[
                ['/', 'Focus global search'],
                ['?', 'Toggle this help'],
                ['Esc', 'Close modal / overlay'],
                ['A', 'Approve focused approval'],
                ['R', 'Reject focused approval'],
                ['J', 'Next approval'],
                ['K', 'Previous approval'],
              ].map(([key, desc]) => (
                <tr key={key} className="border-b border-white/[0.04] last:border-b-0">
                  <td className="py-2.5 pr-3 align-middle">
                    <kbd className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded border border-white/[0.12] bg-white/[0.04] text-white/85 text-xs font-mono">
                      {key}
                    </kbd>
                  </td>
                  <td className="py-2.5 text-white/75">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
