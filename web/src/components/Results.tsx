import { useState } from 'react'
import type { LayoutOptionDto, SolveResponse, Tier, WallDto } from '../api/types'
import { CART_URL } from '../api/client'
import { Elevation, formatInches } from './Elevation'
import { Notices } from './Notices'
import { money } from './Money'

export function Results({
  response,
  wall,
  onStartOver,
}: {
  response: SolveResponse
  wall: WallDto
  onStartOver: () => void
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
          <Sheet key={rank} option={option} rank={rank} wall={wall} />
        ))}
      </div>

      <p className="footnote">
        Prices are for the cabinets shown. Delivery and tax are added at checkout.
      </p>
    </section>
  )
}

function Sheet({ option, rank, wall }: { option: LayoutOptionDto; rank: number; wall: WallDto }) {
  const [tier, setTier] = useState<Tier>('Standard')
  const priced = tier === 'Standard' ? option.standard : option.premiere
  const saving = priced.subtotalList - priced.subtotalPromo

  return (
    <article className="sheet" data-rank={rank}>
      <header className="sheet-head">
        <h3 className="sheet-label">{option.label}</h3>
        <span className="sheet-no data">{`${rank + 1}/3`}</span>
      </header>

      <div className="sheet-body">
        <Elevation
          layout={priced.layout}
          wallLength={wall.length}
          ceiling={wall.ceiling}
          obstructions={wall.obstructions ?? []}
          id={`sheet-${rank}-${tier.toLowerCase()}`}
        />

        <div className="tier-switch" role="group" aria-label="Cabinet level">
          {(['Standard', 'Premiere'] as Tier[]).map((option_) => (
            <button
              type="button"
              key={option_}
              aria-pressed={tier === option_}
              onClick={() => setTier(option_)}
            >
              {option_ === 'Standard' ? 'Doors' : 'Drawers'}
            </button>
          ))}
        </div>

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
        <a className="btn wood" href={CART_URL} style={{ display: 'block', textAlign: 'center' }}>
          Add this wall to cart
        </a>
      </div>
    </article>
  )
}
