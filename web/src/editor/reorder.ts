// web/src/editor/reorder.ts
import type { LayoutDto, PlacedItemDto } from '../api/types'

/*
  Reordering, as the Phase 2 spec defines it: a cabinet moves only within its own row and its own
  unbroken stretch, the stretch is re-packed from its left edge so nothing can gap or overlap, and
  fillers and countertops never move. Whether the result is a *good* wall is the API validator's call.
*/

export type Row = 'floor' | 'wall'

/** Which row an item reorders in, or null for things that never move. */
export function rowOf(item: PlacedItemDto): Row | null {
  if (item.zone === 'Base' || item.zone === 'Tall' || item.zone === 'KneeSpace') return 'floor'
  if (item.zone === 'Wall') return 'wall'
  return null
}

/** One position in a row. Items in the same row at the same x — a stacked pair of uppers — share it. */
interface Slot {
  x: number
  width: number
  indices: number[]
}

const EPS = 1e-6

function stretchOf(layout: LayoutDto, index: number): { slots: Slot[]; at: number } | null {
  const item = layout.items[index]
  const row = item ? rowOf(item) : null
  if (!row) return null

  const byX = new Map<number, Slot>()
  layout.items.forEach((candidate, i) => {
    if (rowOf(candidate) !== row) return
    const slot = byX.get(candidate.x) ?? { x: candidate.x, width: 0, indices: [] }
    slot.width = Math.max(slot.width, candidate.width)
    slot.indices.push(i)
    byX.set(candidate.x, slot)
  })

  // A stretch ends wherever the next slot does not start exactly where this one stops.
  const stretches: Slot[][] = []
  for (const slot of [...byX.values()].sort((a, b) => a.x - b.x)) {
    const run = stretches[stretches.length - 1]
    const last = run?.[run.length - 1]
    if (last && Math.abs(last.x + last.width - slot.x) < EPS) run.push(slot)
    else stretches.push([slot])
  }

  for (const slots of stretches) {
    const at = slots.findIndex((slot) => slot.indices.includes(index))
    if (at >= 0) return { slots, at }
  }
  return null
}

/** Moves the item at `index` by `steps` places within its stretch. The same object when nothing moves. */
export function reorder(layout: LayoutDto, index: number, steps: number): LayoutDto {
  const found = stretchOf(layout, index)
  if (!found || steps === 0) return layout

  const { slots, at } = found
  const to = Math.min(slots.length - 1, Math.max(0, at + steps))
  if (to === at) return layout

  const order = [...slots]
  const [moving] = order.splice(at, 1)
  order.splice(to, 0, moving)

  const newX = new Map<number, number>()
  let cursor = slots[0].x
  for (const slot of order) {
    for (const i of slot.indices) newX.set(i, cursor)
    cursor += slot.width
  }

  return {
    ...layout,
    items: layout.items.map((item, i) => {
      const x = newX.get(i)
      return x === undefined || x === item.x ? item : { ...item, x }
    }),
  }
}

export function canMove(layout: LayoutDto, index: number, direction: -1 | 1): boolean {
  return reorder(layout, index, direction) !== layout
}

/** How many places a drag of `dx` inches moves the item: one per neighbour whose middle it passes. */
export function stepsForDrag(layout: LayoutDto, index: number, dx: number): number {
  const found = stretchOf(layout, index)
  if (!found) return 0

  const { slots, at } = found
  const centre = slots[at].x + slots[at].width / 2 + dx
  const middle = (slot: Slot) => slot.x + slot.width / 2
  let steps = 0

  if (dx > 0) {
    for (let q = at + 1; q < slots.length && centre > middle(slots[q]); q++) steps++
  } else {
    for (let q = at - 1; q >= 0 && centre < middle(slots[q]); q--) steps--
  }
  return steps
}
