import { useEffect, useRef, useState } from 'react'
import { swaps as fetchSwaps } from '../api/client'
import type { PlacedItemDto, PricedLayoutDto, SwapOptionDto } from '../api/types'
import { inches } from './Elevation'
import { money } from './Money'
import { SkuImage } from './SkuImage'

/**
 * What you get when you tap a cabinet: what it is, what it costs, what else fits in the same hole,
 * and a way to take it out.
 */
export function CabinetPanel({
  item,
  index,
  priced,
  onSwap,
  onRemove,
  onClose,
  onMove,
  canMoveLeft,
  canMoveRight,
}: {
  item: PlacedItemDto
  index: number
  priced: PricedLayoutDto
  onSwap: (index: number, option: SwapOptionDto) => void
  onRemove: (index: number) => void
  onClose: () => void
  onMove: (index: number, steps: number) => void
  canMoveLeft: boolean
  canMoveRight: boolean
}) {
  const [options, setOptions] = useState<SwapOptionDto[] | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const isKnee = item.zone === 'KneeSpace'
  const line = priced.lineItems.find((l) => l.sku === item.sku)

  useEffect(() => {
    if (isKnee) {
      // A knee space has no SKU to look up; its alternatives are bases of the same width.
      setOptions(null)
      return
    }

    let live = true
    setOptions(null)
    setFailed(false)

    fetchSwaps(item.sku)
      .then((result) => live && setOptions(result.options))
      .catch(() => live && setFailed(true))

    return () => {
      live = false
    }
  }, [item.sku, isKnee])

  // The panel opens below the parts table, often off screen; scroll just far enough to show it.
  // Again once the swaps arrive, since they make the panel several hundred pixels taller.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [index, options])

  return (
    <div ref={panel} className="editor" role="region" aria-label="Selected cabinet">
      <div>
        {!isKnee && <SkuImage sku={item.sku} alt={line?.name ?? item.sku} size={320} />}
        <h4>{isKnee ? 'Open knee space' : item.sku}</h4>
        <p className="dims">
          {inches(item.width)} wide · {inches(item.height)} tall
          {line ? ` · ${money(line.unitPromo)}` : ''}
        </p>
      </div>

      {failed && <p className="dims">We could not load alternatives just now.</p>}

      {options && options.length > 0 && (
        <div>
          <p className="dims">Swap it for</p>
          <div className="swaps">
            {options.map((option) => (
              <button
                type="button"
                key={option.sku || 'knee'}
                className="swap"
                onClick={() => onSwap(index, option)}
              >
                <SkuImage sku={option.sku} alt={option.name} size={96} />
                <span>{option.sku || 'Open knee space'}</span>
                <span className="delta">{option.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {options?.length === 0 && <p className="dims">Nothing else fits this spot.</p>}

      <div className="row move-row" role="group" aria-label="Move this cabinet">
        <button type="button" className="btn ghost" disabled={!canMoveLeft} onClick={() => onMove(index, -1)}>
          Move left
        </button>
        <button type="button" className="btn ghost" disabled={!canMoveRight} onClick={() => onMove(index, 1)}>
          Move right
        </button>
      </div>

      <div className="row">
        <button type="button" className="btn ghost" onClick={() => onRemove(index)}>
          Remove
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
