// web/src/geometry/__tests__/fronts.test.ts
import { describe, expect, it } from 'vitest'
import { boxHeight, drawerCount, frontLayoutOf, fronts, hasLegs, LEG, legPositions, legRects, PULL } from '../fronts'
import type { PlacedItemDto, Zone } from '../../api/types'
import catalog from '../../../../data/catalog.json'

const make = (sku: string, zone: Zone, width: number, height: number, depth = 24, x = 0, y = 0): PlacedItemDto =>
  ({ sku, x, y, width, height, depth, zone })

/** Every cabinet in the catalog, placed at the origin with its catalog size. */
const everyCabinet = (catalog as { cabinets: { sku: string; zone: Zone; w: number; h: number; d: number }[] }).cabinets
  .filter((c) => c.zone !== 'Filler')
  .map((c) => make(c.sku, c.zone, c.w, c.h, c.d, 0, c.zone === 'Wall' ? 54 : 0))

describe('frontLayoutOf, as the renders show each cabinet', () => {
  it.each([
    ['MV-B15', 'Base', 15, 'drawerOverDoor'],
    ['MV-BWB15-PS', 'Base', 15, 'drawerOverDoor'],
    ['MV-B24', 'Base', 24, 'drawerOverPair'],
    ['MV-B30', 'Base', 30, 'drawerOverPair'],
    ['MV-B24-F', 'Base', 24, 'pair'],
    ['MV-B30-F', 'Base', 30, 'pair'],
    ['MV-DB24-3', 'Base', 24, 'drawers'],
    ['MV-DB30-4', 'Base', 30, 'drawers'],
    ['MV-PC2484', 'Tall', 24, 'pantry'],
    ['MV-PC3084', 'Tall', 30, 'pantry'],
    ['MV-W1530', 'Wall', 15, 'single'],
    ['MV-W2430', 'Wall', 24, 'pair'],
    ['IC-MW-W3015', 'Wall', 30, 'pair'],
  ] as const)('%s is %s', (sku, zone, width, layout) => {
    expect(frontLayoutOf(make(sku, zone, width, 34.5))).toBe(layout)
  })
})

describe('fronts', () => {
  const base = (sku: string, width: number) => make(sku, 'Base', width, 34.5)

  it('puts a 6" drawer over the doors of B15, B24 and B30', () => {
    for (const [sku, width, doors] of [['MV-B15', 15, 1], ['MV-B24', 24, 2], ['MV-B30', 30, 2]] as const) {
      const { faces } = fronts(base(sku, width), 0)
      expect(faces).toHaveLength(1 + doors)
      expect(faces[0].height).toBeCloseTo(6, 9)
      expect(faces[1].y).toBeGreaterThan(faces[0].y + faces[0].height)
    }
  })

  it('graduates a 3-drawer base: short on top, deepest at the bottom', () => {
    const [top, middle, bottom] = fronts(base('MV-DB30-3', 30), 0).faces.map((f) => f.height)
    expect(top).toBeLessThan(middle)
    expect(middle).toBeLessThan(bottom)
  })

  it('keeps a 4-drawer base even', () => {
    const heights = fronts(base('MV-DB24-4', 24), 0).faces.map((f) => f.height)
    for (const h of heights) expect(h).toBeCloseTo(heights[0], 9)
  })

  it('gives a pantry a short upper pair over a tall lower pair, pulls either side of the split', () => {
    const pantry = make('MV-PC3084', 'Tall', 30, 84)
    const { faces, pulls } = fronts(pantry, 0)
    expect(faces).toHaveLength(4)
    expect(faces[0].height).toBeLessThan(faces[2].height)
    const split = faces[0].y + faces[0].height
    expect(pulls[0].y + pulls[0].height).toBeCloseTo(split - PULL.endInset, 9) // upper pull near its bottom
    expect(pulls[2].y).toBeCloseTo(faces[2].y + PULL.endInset, 9) // lower pull near its top
  })

  it('pulls base doors near the top and wall doors near the bottom', () => {
    const b = fronts(base('MV-B24-F', 24), 0)
    expect(b.pulls[0].y).toBeCloseTo(b.faces[0].y + PULL.endInset, 9)
    const w = fronts(make('MV-W2430', 'Wall', 24, 30, 12, 0, 54), 0)
    expect(w.pulls[0].y + w.pulls[0].height).toBeCloseTo(w.faces[0].y + w.faces[0].height - PULL.endInset, 9)
  })

  it('pulls a pair at the meeting edges and a single door on its right', () => {
    const pair = fronts(base('MV-B24-F', 24), 0)
    expect(pair.pulls[0].x).toBeGreaterThan(pair.faces[0].x + pair.faces[0].width / 2)
    expect(pair.pulls[1].x).toBeLessThan(pair.faces[1].x + pair.faces[1].width / 2)
    const single = fronts(make('MV-W1530', 'Wall', 15, 30, 12, 0, 54), 0)
    expect(single.pulls[0].x).toBeGreaterThan(single.faces[0].x + single.faces[0].width / 2)
  })

  it('lays drawer pulls level and centered', () => {
    const { faces, pulls } = fronts(base('MV-DB24-3', 24), 0)
    pulls.forEach((p, i) => {
      expect(p.width).toBeGreaterThan(p.height)
      expect(p.x + p.width / 2).toBeCloseTo(faces[i].x + faces[i].width / 2, 9)
    })
  })

  it('keeps every face inside the box and every pull inside its face, for every catalog cabinet', () => {
    for (const item of everyCabinet) {
      const top = 0
      const { faces, pulls } = fronts(item, top)
      expect(faces.length).toBeGreaterThan(0)
      faces.forEach((f, i) => {
        expect(f.x).toBeGreaterThanOrEqual(item.x)
        expect(f.x + f.width).toBeLessThanOrEqual(item.x + item.width + 1e-9)
        expect(f.y).toBeGreaterThanOrEqual(top)
        expect(f.y + f.height).toBeLessThanOrEqual(top + boxHeight(item) + 1e-9)
        const p = pulls[i]
        expect(p.x).toBeGreaterThanOrEqual(f.x - 1e-9)
        expect(p.x + p.width).toBeLessThanOrEqual(f.x + f.width + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(f.y - 1e-9)
        expect(p.y + p.height).toBeLessThanOrEqual(f.y + f.height + 1e-9)
      })
    }
  })

  it('mirrors between page (down) and floor (up) coordinates', () => {
    const item = base('MV-DB24-4', 24)
    const page = fronts(item, 0, 1).faces.map((f) => f.y)
    const floor = fronts(item, item.height, -1).faces.map((f) => item.height - f.y)
    floor.forEach((value, i) => expect(value).toBeCloseTo(page[i], 9))
  })
})

describe('legs', () => {
  it('stand under bases and pantries only', () => {
    expect(hasLegs(make('MV-B24-F', 'Base', 24, 34.5))).toBe(true)
    expect(hasLegs(make('MV-PC2484', 'Tall', 24, 84))).toBe(true)
    for (const zone of ['Wall', 'Filler', 'Counter', 'KneeSpace'] as const) expect(hasLegs(make('X', zone, 24, 30))).toBe(false)
  })

  it('shorten the box by exactly the leg height, so the listed height is unchanged', () => {
    expect(boxHeight(make('MV-B24-F', 'Base', 24, 34.5)) + LEG.height).toBe(34.5)
    expect(boxHeight(make('MV-PC3084', 'Tall', 30, 84))).toBe(80)
    expect(boxHeight(make('MV-W2430', 'Wall', 24, 30, 12))).toBe(30)
  })

  it('are four per cabinet, set in from every edge', () => {
    const item = make('MV-DB30-3', 'Base', 30, 34.5, 24, 40)
    const legs = legPositions(item)
    expect(legs).toHaveLength(4)
    const r = LEG.sleeveDiameter / 2
    for (const leg of legs) {
      expect(leg.x - r).toBeGreaterThanOrEqual(item.x + LEG.inset - 1e-9)
      expect(leg.x + r).toBeLessThanOrEqual(item.x + item.width - LEG.inset + 1e-9)
      expect(leg.z - r).toBeGreaterThanOrEqual(LEG.inset - 1e-9)
      expect(leg.z + r).toBeLessThanOrEqual(item.depth - LEG.inset + 1e-9)
    }
  })

  it('never reach into the cabinet next door', () => {
    const left = make('MV-B15', 'Base', 15, 34.5, 24, 0)
    const right = make('MV-B15', 'Base', 15, 34.5, 24, 15)
    const maxLeft = Math.max(...legPositions(left).map((l) => l.x + LEG.sleeveDiameter / 2))
    const minRight = Math.min(...legPositions(right).map((l) => l.x - LEG.sleeveDiameter / 2))
    expect(maxLeft).toBeLessThan(minRight)
  })

  it('show the front pair in elevation as a sleeve over a slimmer foot, standing on the floor', () => {
    const rects = legRects(make('MV-B24-F', 'Base', 24, 34.5), 96, 1)
    expect(rects).toHaveLength(4)
    const [sleeve, foot] = rects
    expect(foot.width).toBeLessThan(sleeve.width)
    expect(sleeve.y).toBeCloseTo(96 - LEG.height, 9)
    expect(foot.y + foot.height).toBeCloseTo(96, 9)
  })
})

describe('drawerCount', () => {
  it('counts drawers only on drawer stacks', () => {
    expect(drawerCount('MV-DB30-4')).toBe(4)
    expect(drawerCount('MV-DB24-3')).toBe(3)
    expect(drawerCount('MV-B30-F')).toBe(0)
    expect(drawerCount('MV-BWB15-PS')).toBe(0)
  })
})
