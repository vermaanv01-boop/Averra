import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn.js'

export default function Modal({ open, title, description, onClose, children, footer, size = 'md' }) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-card border border-ink-200 bg-white shadow-lift outline-none sm:rounded-card',
          size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-xl text-ink-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-600">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ivory-100 hover:text-ink-900"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">{children}</div>

        {footer && <div className="border-t border-ink-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
