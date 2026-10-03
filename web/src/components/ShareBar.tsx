import { useState } from 'react'
import { captureLead, saveDesign, track } from '../api/client'
import type { Goal, LayoutDto, WallDto } from '../api/types'

export const DESIGN_PATH = '/garage/design'

/**
 * Save the wall, get a short code, and do the two things people ask for next: send it to me, or get
 * a person involved.
 */
export function ShareBar({
  wall,
  goal,
  layout,
  configId,
  onSaved,
}: {
  wall: WallDto
  goal: Goal
  layout: LayoutDto
  configId: string | null
  onSaved: (configId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'EmailMe' | 'DesignerHelp' | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const link = configId ? `${window.location.origin}${DESIGN_PATH}/${configId}` : null

  const ensureSaved = async (): Promise<string> => {
    if (configId) return configId

    const saved = await saveDesign(wall, goal, layout)
    track('share_created', saved.configId)
    onSaved(saved.configId)

    return saved.configId
  }

  const share = async () => {
    setBusy(true)
    setProblem(null)

    try {
      const id = await ensureSaved()
      const url = `${window.location.origin}${DESIGN_PATH}/${id}`

      if (navigator.clipboard) await navigator.clipboard.writeText(url)
      setSent(`Link copied: ${url}`)
    } catch {
      setProblem('We couldn’t save the design just now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!kind) return

    setBusy(true)
    setProblem(null)

    try {
      const id = await ensureSaved()
      await captureLead({ kind, email, configId: id, message: message || null })
      track('lead_captured', id, { kind })
      setSent(
        kind === 'EmailMe'
          ? 'Sent. Check your inbox for the drawing and the parts list.'
          : 'Thanks — a designer will be in touch about this wall.',
      )
      setKind(null)
      setEmail('')
      setMessage('')
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'That didn’t send. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sharebar">
      <div className="row">
        <button type="button" className="btn ghost" onClick={share} disabled={busy}>
          {link ? 'Copy share link' : 'Save & copy link'}
        </button>
        <button type="button" className="btn ghost" onClick={() => setKind('EmailMe')} disabled={busy}>
          Email me this
        </button>
        <button type="button" className="btn ghost" onClick={() => setKind('DesignerHelp')} disabled={busy}>
          Have a designer tweak it
        </button>
      </div>

      {link && <p className="edited-note">Your design code is {link.split('/').pop()}.</p>}

      {kind && (
        <form className="leadform" onSubmit={submitLead}>
          <label className="field-label" htmlFor={`email-${kind}`}>
            {kind === 'EmailMe' ? 'Where should we send it?' : 'How do we reach you?'}
          </label>
          <input
            id={`email-${kind}`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          {kind === 'DesignerHelp' && (
            <>
              <label className="field-label" htmlFor="lead-message">
                What would you change?
              </label>
              <textarea
                id="lead-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="There's a window I couldn't describe…"
              />
            </>
          )}

          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Sending…' : 'Send'}
            </button>
            <button type="button" className="btn ghost" onClick={() => setKind(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {sent && <p className="edited-note" role="status">{sent}</p>}
      {problem && <p className="edited-note" role="alert">{problem}</p>}
    </section>
  )
}
