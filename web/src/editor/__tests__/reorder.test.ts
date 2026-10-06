// web/src/editor/__tests__/reorder.test.ts
import { describe, expect, it } from 'vitest'
import { canMove, reorder, rowOf, stepsForDrag } from '../reorder'
import type { LayoutDto, PlacedItemDto, SolveResponse } from '../../api/types'
import vignetteJson from '../../fixtures/vignette-72.json'
import panelJson from '../../fixtures/two-car-panel.json'

const vignette = (vignetteJson as SolveResponse).options[0].standard.layout
const panel = (panelJson as SolveResponse).options[0].standard.layout

const at = (layout: LayoutDto, sku: string, x: number) =>
  layout.items.findIndex((item) => item.sku === sku && item.x === x)

function wallItem(sku: string, x: number, y: number, width: number, height: number): PlacedItemDto {
  return { sku, x, y, width, height, depth: 12, zone: 'Wall' }
}

/** Per row: sorted, no overlaps, and the same overall extent as before. */
function expectPacked(before: LayoutDto, after: LayoutDto) {
  for (const row of ['floor', 'wall'] as const) {
    const pick = (l: LayoutDto) => l.items.filter((i) => rowOf(i) === row).sort((a, b) => a.x - b.x || a.y - b.y)
    const was = pick(before)
    const now = pick(after)
    const width = (items: PlacedItemDto[]) => items.reduce((sum, i) => sum + i.width, 0)
    expect(width(now)).toBe(width(was))
    for (let i = 1; i < now.length; i++) {
      if (now[i].x === now[i - 1].x) continue // a stack shares an x
      expect(now[i - 1].x + now[i - 1].width).toBeLessThanOrEqual(now[i].x + 1e-6)
    }
  }
}

describe('rowOf', () => {
  it('puts bases, talls and knee spaces on the floor row and uppers on the wall row', () => {
    expect(rowOf(vignette.items[0])).toBe('floor')
    expect(rowOf(vignette.items[1])).toBe('floor')
    expect(rowOf(vignette.items[4])).toBe('wall')
  })

  it('never moves counters or fillers', () => {
    expect(rowOf(vignette.items[3])).toBeNull()
    expect(rowOf(panel.items[at(panel, 'MV-F384', 203)])).toBeNull()
  })
})

describe('reorder', () => {
  it('trades places with the neighbour and re-packs from the start of the stretch', () => {
    const moved = reorder(vignette, 0, 1)
    expect(moved.items[1].x).toBe(0) // knee space
    expect(moved.items[0].x).toBe(24) // the base that moved
    expect(moved.items[2].x).toBe(48)
  })

  it('leaves the other row, the counter and item order alone', () => {
    const moved = reorder(vignette, 0, 1)
    expect(moved.items.map((i) => i.sku)).toEqual(vignette.items.map((i) => i.sku))
    for (const i of [3, 4, 5, 6]) expect(moved.items[i]).toBe(vignette.items[i])
  })

  it('re-packs mixed widths without gaps', () => {
    const pantry = at(panel, 'MV-PC3084', 96)
    const moved = reorder(panel, pantry, -1)
    expect(moved.items[pantry].x).toBe(72)
    expect(moved.items[at(panel, 'MV-B24-F', 72)].x).toBe(102)
    expectPacked(panel, moved)
  })

  it('never crosses the gap left for an obstruction', () => {
    expect(reorder(panel, at(panel, 'MV-B15', 156), 1)).toBe(panel)
    expect(reorder(panel, at(panel, 'MV-B15', 206), -1)).toBe(panel)
  })

  it('clamps a long move to the end of the stretch', () => {
    const first = at(panel, 'MV-B24-F', 0)
    const moved = reorder(panel, first, 99)
    expect(moved.items[first].x).toBe(171 - 24)
    expectPacked(panel, moved)
  })

  it('returns the same layout for fillers, counters and zero steps', () => {
    expect(reorder(panel, at(panel, 'MV-F384', 203), 1)).toBe(panel)
    expect(reorder(vignette, 3, 1)).toBe(vignette)
    expect(reorder(vignette, 0, 0)).toBe(vignette)
  })

  it('keeps every row packed whatever is moved', () => {
    for (let index = 0; index < panel.items.length; index++) {
      for (const steps of [-3, -1, 1, 3]) expectPacked(panel, reorder(panel, index, steps))
    }
  })

  it('moves a stacked pair of uppers as one', () => {
    const stacked: LayoutDto = {
      items: [
        wallItem('MV-W3030', 0, 54, 30, 30),
        wallItem('IC-MW-W3015', 0, 84, 30, 15),
        wallItem('MV-W3030', 30, 54, 30, 30),
      ],
    }
    const moved = reorder(stacked, 1, 1)
    expect(moved.items[0].x).toBe(30)
    expect(moved.items[1].x).toBe(30)
    expect(moved.items[2].x).toBe(0)
  })
})

describe('canMove', () => {
  it('is false at either end of a stretch and true inside it', () => {
    expect(canMove(vignette, 0, -1)).toBe(false)
    expect(canMove(vignette, 0, 1)).toBe(true)
    expect(canMove(vignette, 2, 1)).toBe(false)
    expect(canMove(vignette, 3, 1)).toBe(false)
  })
})

describe('stepsForDrag', () => {
  it('counts a step for each neighbour whose middle the dragged cabinet passes', () => {
    expect(stepsForDrag(vignette, 0, 10)).toBe(0) // centre 22, knee centre 36
    expect(stepsForDrag(vignette, 0, 30)).toBe(1) // centre 42
    expect(stepsForDrag(vignette, 0, 100)).toBe(2)
    expect(stepsForDrag(vignette, 2, -30)).toBe(-1)
  })

  it('is zero for things that do not move', () => {
    expect(stepsForDrag(vignette, 3, 50)).toBe(0)
  })
})
