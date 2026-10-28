import { useCallback, useEffect, useRef, useState } from 'react'
import { price as priceLayout, track, validate } from '../api/client'
import type { LayoutDto, PlacedItemDto, PricedLayoutDto, SwapOptionDto, ViolationDto, WallDto } from '../api/types'

export interface WallEditor {
  layout: LayoutDto
  priced: PricedLayoutDto
  violations: ViolationDto[]
  checking: boolean
  edited: boolean
  swap: (index: number, option: SwapOptionDto) => void
  remove: (index: number) => void
  reset: () => void
}

/**
 * Holds a working copy of one layout and keeps the API's opinion of it up to date. Every edit
 * re-validates and re-prices rather than doing the arithmetic here, so the rules only live in one
 * place and the price on screen is the price the cart will charge.
 */
export function useWallEditor(
  original: PricedLayoutDto,
  wall: WallDto,
  configId?: string | null,
): WallEditor {
  const [layout, setLayout] = useState<LayoutDto>(original.layout)
  const [priced, setPriced] = useState<PricedLayoutDto>(original)
  const [violations, setViolations] = useState<ViolationDto[]>([])
  const [checking, setChecking] = useState(false)
  const [source, setSource] = useState(original)

  // Reset when the sheet switches tier underneath us. This happens during render, not in an
  // effect, so no effect ever sees the new tier's original paired with the old tier's layout —
  // that pairing looked like an edit and sent a reprice of the old tier that then overwrote the
  // new tier's prices.
  if (source !== original) {
    setSource(original)
    setLayout(original.layout)
    setPriced(original)
    setViolations([])
    setChecking(false)
  }

  const edited = layout !== original.layout
  const run = useRef(0)

  useEffect(() => {
    if (layout === original.layout) {
      // Back to the original (undo, or a tier switch): anything still in flight is stale.
      run.current++
      setChecking(false)
      return
    }

    const ticket = ++run.current
    setChecking(true)

    Promise.all([validate(layout, wall), priceLayout(layout)])
      .then(([checked, repriced]) => {
        // An older request finishing late must not overwrite a newer answer.
        if (ticket !== run.current) return
        setViolations(checked.violations)
        setPriced(repriced)
      })
      .catch(() => {
        if (ticket === run.current) {
          setViolations([
            { code: 'Offline', message: 'We could not check that change. Your connection may be down.', sku: null },
          ])
        }
      })
      .finally(() => {
        if (ticket === run.current) setChecking(false)
      })
  }, [layout, wall, original.layout])

  const swap = useCallback(
    (index: number, option: SwapOptionDto) => {
      setLayout((current) => ({
        ...current,
        items: current.items.map((item, i) => (i === index ? swapped(item, option, current.items) : item)),
      }))
      track('layout_edited', configId, { change: 'swap', to: option.sku || option.name })
    },
    [configId],
  )

  const remove = useCallback(
    (index: number) => {
      setLayout((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))
      track('layout_edited', configId, { change: 'remove' })
    },
    [configId],
  )

  const reset = useCallback(() => {
    setLayout(original.layout)
    setPriced(original)
    setViolations([])
  }, [original])

  return { layout, priced, violations, checking, edited, swap, remove, reset }
}

/**
 * The replacement takes the option's size, not just its SKU: a 30" upper swapped for its 15" bridge
 * would otherwise keep drawing, validating and quoting as 30" tall. An upper keeps its top on the
 * datum line, unless it is stacked on another upper, where it keeps its bottom instead.
 */
function swapped(item: PlacedItemDto, option: SwapOptionDto, items: PlacedItemDto[]): PlacedItemDto {
  const stacked = items.some((other) => other !== item && other.zone === 'Wall' && other.y + other.height === item.y)
  const y = item.zone === 'Wall' && !stacked ? item.y + item.height - option.height : item.y

  return { ...item, sku: option.sku, zone: option.zone, height: option.height, depth: option.depth, y }
}
