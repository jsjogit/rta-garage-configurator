import { useEffect, useState } from 'react'
import type { LayoutOptionDto, SolveResponse, Tier, WallDto } from '../api/types'
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

export function Results({
  response,
  wall,
  onStartOver,
  configId,
}: {
  response: SolveResponse
  wall: WallDto
  onStartOver: () => void
  configId?: string | null
}) {
  if (response.failure) {
    return (
      <section className="failure">
        <h2>We can’t plan this wall</h2>
        <p>{response.failure.message}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onStartOver}>
            Change the measurements
          </button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="results-head">
        <div>
          <p className="eyebrow">
            {formatInches(wall.length)} wall · {formatInches(wall.ceiling)} ceiling
          </p>
          <h2>Three ways to build it</h2>
        </div>
        <button type="button" className="btn ghost" onClick={onStartOver}>
          Start over
        </button>
      </div>

      <Notices notices={response.notices} />

      <div className="sheets">
        {response.options.map((option, rank) => (
          <Sheet key={rank} option={option} rank={rank} wall={wall} configId={configId} />
        ))}
      </div>

      <p className="footnote">
        Prices are for the cabinets shown. Delivery and tax are added at checkout.
      </p>
    </section>
  )
}

function Sheet({
  option,
  rank,
  wall,
  configId,
}: {
  option: LayoutOptionDto
  rank: number
  wall: WallDto
  configId?: string | null
}) {
  const [tier, setTier] = useState<Tier>('Standard')
  const [selected, setSelected] = useState<number | null>(null)
  const chosen = tier === 'Standard' ? option.standard : option.premiere
  const editor = useWallEditor(chosen, wall, configId)
  const priced = editor.priced
  const saving = priced.subtotalList - priced.subtotalPromo
  const blocked = editor.violations.length > 0

  useEffect(() => setSelected(null), [tier])

  return (
    <article className="sheet" data-rank={rank}>
      <header className="sheet-head">
        <h3 className="sheet-label">{option.label}</h3>
        <span className="sheet-no data">{`${rank + 1}/3`}</span>
      </header>

      <div className="sheet-body">
        <Elevation
          layout={editor.layout}
          wallLength={wall.length}
          ceiling={wall.ceiling}
          obstructions={wall.obstructions ?? []}
          id={`sheet-${rank}-${tier.toLowerCase()}`}
          selected={selected}
          onSelect={setSelected}
        />

        <div>
          <div className="tier-switch" role="group" aria-label="Cabinet tier">
            {(['Standard', 'Premiere'] as Tier[]).map((name) => (
              <button type="button" key={name} aria-pressed={tier === name} onClick={() => setTier(name)}>
                {name}
              </button>
            ))}
          </div>
          {/* The names are the brand's; this line is what the customer is actually choosing between. */}
          <p className="tier-note">{TIER_NOTES[tier]}</p>
        </div>

        {blocked && (
          <ul className="violations">
            {editor.violations.map((violation, i) => (
              <li key={`${violation.code}-${i}`}>{violation.message}</li>
            ))}
          </ul>
        )}

        {editor.edited && (
          <p className="edited-note">
            Edited{editor.checking ? ' · checking…' : ''} ·{' '}
            <button type="button" className="linklike" onClick={editor.reset}>
              undo my changes
            </button>
          </p>
        )}

        <ul className="lines">
          {priced.lineItems.map((line) => (
            <li key={line.sku}>
              <span className="qty">{line.quantity}×</span>
              <span className="dots" aria-hidden="true" />
              <span>{line.sku}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="title-block">
        <span className="k">{saving > 0 ? 'Sale price' : 'Price'}</span>
        <span className="v">{money(priced.subtotalPromo)}</span>
        {saving > 0 && (
          <>
            <span className="k">Was</span>
            <span className="was">{money(priced.subtotalList)}</span>
          </>
        )}
      </div>

      <div style={{ padding: '0 0.9rem 0.9rem' }}>
        <AddToCart layout={editor.layout} configId={configId} blocked={blocked} rank={rank} />
      </div>

      {selected !== null && editor.layout.items[selected] && (
        <CabinetPanel
          item={editor.layout.items[selected]}
          index={selected}
          priced={priced}
          onSwap={(index, sku, name) => {
            editor.swap(index, sku, name)
            setSelected(null)
          }}
          onRemove={(index) => {
            editor.remove(index)
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
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
      <button
        type="button"
        className="btn wood"
        style={{ display: 'block', width: '100%' }}
        disabled={blocked || working}
        onClick={add}
      >
        {blocked ? 'Fix the wall first' : working ? 'Adding…' : 'Add this wall to cart'}
      </button>
      {problem && <p className="edited-note" role="status">{problem}</p>}
    </>
  )
}
