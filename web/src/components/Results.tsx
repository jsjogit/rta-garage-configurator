import { useEffect, useState } from 'react'
import type { LayoutDto, LayoutOptionDto, SolveResponse, Tier, WallDto } from '../api/types'
import { buildCart, track } from '../api/client'
import { Elevation, formatInches } from './Elevation'
import { Notices } from './Notices'
import { money } from './Money'
import { CabinetPanel } from './CabinetPanel'
import { useWallEditor } from '../hooks/useWallEditor'

const TIER_NOTES: Record<Tier, string> = {
  Standard: 'Full-height doors on the base cabinets.',
  Premiere: 'Drawer banks instead, wherever the width allows.',
}

/** The wall the customer is looking at: the sheet they last switched or edited, with its tier and edits. */
export interface ActiveWall {
  label: string
  tier: Tier
  layout: LayoutDto
  edited: boolean
}

export function Results({
  response,
  wall,
  onStartOver,
  configId,
  onActiveChange,
}: {
  response: SolveResponse
  wall: WallDto
  onStartOver: () => void
  configId?: string | null
  onActiveChange?: (active: ActiveWall) => void
}) {
  const [activeRank, setActiveRank] = useState(0)

  if (response.failure) {
    return (
      <section className="failure">
        <h2>We can’t plan this wall</h2>
        <p>{response.failure.message}</p>
        <div className="sheet-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onStartOver}>
            Change the measurements
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="stage">
      <div className="stage-head">
        <h2>{response.options.length === 1 ? 'Your wall' : 'Three ways to build it'}</h2>
        <span className="meta">
          {formatInches(wall.length)} wall · {formatInches(wall.ceiling)} ceiling
        </span>
      </div>

      <Notices notices={response.notices} />

      <div className="results">
        {response.options.map((option, rank) => (
          <Sheet
            key={rank}
            option={option}
            rank={rank}
            count={response.options.length}
            wall={wall}
            configId={configId}
            onTouch={() => setActiveRank(rank)}
            onActiveChange={rank === activeRank ? onActiveChange : undefined}
          />
        ))}
      </div>

      <p className="footnote">Prices are for the cabinets shown. Delivery and tax are added at checkout.</p>
    </section>
  )
}

function Sheet({
  option,
  rank,
  count,
  wall,
  configId,
  onTouch,
  onActiveChange,
}: {
  option: LayoutOptionDto
  rank: number
  count: number
  wall: WallDto
  configId?: string | null
  onTouch: () => void
  onActiveChange?: (active: ActiveWall) => void
}) {
  // A saved design comes back as one layout in both slots: there is no other tier to switch to.
  const fixedTier = option.standard === option.premiere
  const [tier, setTier] = useState<Tier>(fixedTier ? (option.standard.layout.tier ?? 'Standard') : 'Standard')
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const chosen = tier === 'Standard' ? option.standard : option.premiere
  const editor = useWallEditor(chosen, wall, configId)
  const priced = editor.priced
  const saving = priced.subtotalList - priced.subtotalPromo
  const blocked = editor.violations.length > 0

  useEffect(() => setSelected(null), [tier])

  useEffect(() => {
    onActiveChange?.({ label: option.label, tier, layout: editor.layout, edited: editor.edited })
  }, [onActiveChange, option.label, tier, editor.layout, editor.edited])

  return (
    <article className="sheet" data-rank={rank}>
      <header className="sheet-head">
        <h3>{option.label}</h3>
        {count > 1 && <span className="rank">{`${rank + 1} of ${count}`}</span>}
      </header>

      <div className="sheet-body">
        <div className="drawing">
          <Elevation
            layout={editor.layout}
            wallLength={wall.length}
            ceiling={wall.ceiling}
            obstructions={wall.obstructions ?? []}
            id={`sheet-${rank}-${tier.toLowerCase()}`}
            selected={editing ? selected : null}
            onSelect={editing ? setSelected : undefined}
          />
        </div>

        <div className="parts">
          {!fixedTier && (
            <div className="tier-switch" role="group" aria-label="Cabinet tier">
              {(['Standard', 'Premiere'] as Tier[]).map((name) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={tier === name}
                  onClick={() => {
                    setTier(name)
                    onTouch()
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <p className="tier-note">{TIER_NOTES[tier]}</p>

          <table className="parts-table">
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Description</th>
                <th scope="col" className="num">Qty</th>
                <th scope="col" className="num">Unit</th>
                <th scope="col" className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {priced.lineItems.map((line) => (
                <tr key={line.sku}>
                  <td className="sku">{line.sku}</td>
                  <td className="desc">{line.name}</td>
                  <td className="num">{line.quantity}</td>
                  <td className="num">{money(line.unitPromo)}</td>
                  <td className="num">{money(line.extendedPromo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="num">{money(priced.subtotalPromo)}</td>
              </tr>
              {saving > 0 && (
                <tr>
                  <td colSpan={4} className="was">Was</td>
                  <td className="num was">{money(priced.subtotalList)}</td>
                </tr>
              )}
            </tfoot>
          </table>

          {blocked && (
            <ul className="violations">
              {editor.violations.map((violation, i) => (
                <li key={`${violation.code}-${i}`}>{violation.message}</li>
              ))}
            </ul>
          )}

          <div className="sheet-actions">
            <AddToCart layout={editor.layout} configId={configId} blocked={blocked} rank={rank} />

            {editor.edited ? (
              <p className="edited-note">
                Edited{editor.checking ? ' · checking…' : ''} ·{' '}
                <button type="button" className="linklike" onClick={editor.reset}>
                  undo my changes
                </button>
              </p>
            ) : (
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setEditing((on) => !on)
                  setSelected(null)
                }}
              >
                {editing ? 'Done editing' : 'Edit this wall'}
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && selected !== null && editor.layout.items[selected] && (
        <CabinetPanel
          item={editor.layout.items[selected]}
          index={selected}
          priced={priced}
          onSwap={(index, sku, name) => {
            editor.swap(index, sku, name)
            onTouch()
            setSelected(null)
          }}
          onRemove={(index) => {
            editor.remove(index)
            onTouch()
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {editing && selected === null && (
        <div className="editor">
          <p className="dims">Tap a cabinet in the drawing to swap or remove it.</p>
        </div>
      )}
    </article>
  )
}

/**
 * nopCommerce adds by product id, so the API tells us the exact posts to make. If it cannot — the
 * SKU-to-id map is incomplete — we say so rather than adding part of a wall.
 */
function AddToCart({
  layout,
  configId,
  blocked,
  rank,
}: {
  layout: LayoutOptionDto['standard']['layout']
  configId?: string | null
  blocked: boolean
  rank: number
}) {
  const [problem, setProblem] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const add = async () => {
    setWorking(true)
    setProblem(null)

    try {
      const handoff = await buildCart(layout, configId ?? undefined)

      if (!handoff.ready) {
        setProblem(
          'We can’t add this wall automatically yet. Save the design and a designer can place the order for you.',
        )
        return
      }

      // The cart is identified by the store's session cookie, so these posts only land when this
      // page is being served by the store. Anywhere else they would quietly 404.
      if (window.location.origin !== handoff.storeOrigin) {
        track('cart_add_all', configId, { rank: String(rank), handoff: 'offsite' })
        window.location.href = handoff.cartUrl
        return
      }

      track('cart_add_all', configId, { rank: String(rank), lines: String(handoff.lines.length) })

      for (const step of handoff.requests) {
        await fetch(step.url, { method: step.method })
        track('cart_add_item', configId)
      }

      window.location.href = handoff.cartUrl
    } catch {
      setProblem('We couldn’t reach the cart. Try again in a moment.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <button type="button" className="btn accent" disabled={blocked || working} onClick={add}>
        {blocked ? 'Fix the wall first' : working ? 'Adding…' : 'Add all to cart'}
      </button>
      {problem && (
        <p className="edited-note" role="status">
          {problem}
        </p>
      )}
    </>
  )
}
