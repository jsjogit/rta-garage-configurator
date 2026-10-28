// web/src/components/ThreeDDialog.tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * The 3D view at a size worth looking at: a native <dialog>, so focus is trapped, Escape closes it
 * and the page behind is inert without any of that being re-implemented here. It is portalled to
 * <body> so it never inherits the card's layout, and focus starts on Close so Escape and Tab behave.
 */
export function ThreeDDialog({
  open,
  onClose,
  title,
  total,
  tierSwitch,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  total: string
  tierSwitch: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('.three-d-close')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return createPortal(
    <dialog
      ref={ref}
      className="three-d-dialog"
      aria-labelledby="three-d-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself, not its contents.
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header className="three-d-head">
        <h2 id="three-d-title">{title}</h2>
        {tierSwitch}
        <span className="three-d-total">{total}</span>
        <button type="button" className="btn ghost three-d-close" onClick={onClose} aria-label="Close 3D view">
          Close
        </button>
      </header>
      <div className="three-d-body">{children}</div>
    </dialog>,
    document.body,
  )
}
