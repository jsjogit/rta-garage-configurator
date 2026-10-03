import { useCallback, useEffect, useRef, useState } from 'react'
import { price as priceLayout, track, validate } from '../api/client'
import type { LayoutDto, PricedLayoutDto, ViolationDto, WallDto } from '../api/types'

export interface WallEditor {
  layout: LayoutDto
  priced: PricedLayoutDto
  violations: ViolationDto[]
  checking: boolean
  edited: boolean
  swap: (index: number, sku: string, name: string) => void
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
  const edited = layout !== original.layout

  // Reset when the sheet switches tier underneath us.
  useEffect(() => {
    setLayout(original.layout)
    setPriced(original)
    setViolations([])
  }, [original])

  const run = useRef(0)

  useEffect(() => {
    if (layout === original.layout) return

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
    (index: number, sku: string, name: string) => {
      setLayout((current) => ({
        ...current,
        items: current.items.map((item, i) =>
          i === index
            ? { ...item, sku, zone: sku === '' ? 'KneeSpace' : item.zone === 'KneeSpace' ? 'Base' : item.zone }
            : item,
        ),
      }))
      track('layout_edited', configId, { change: 'swap', to: sku || name })
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
