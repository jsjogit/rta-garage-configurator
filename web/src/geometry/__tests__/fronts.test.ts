// web/src/geometry/__tests__/fronts.test.ts
import { describe, expect, it } from 'vitest'
import { drawerCount, fronts } from '../fronts'
import type { PlacedItemDto } from '../../api/types'

const base = (sku: string, width = 24): PlacedItemDto => ({ sku, x: 10, y: 0, width, height: 34.5, depth: 24, zone: 'Base' })

describe('fronts', () => {
  it('gives a 24 inch door base a pair of doors with upright pulls', () => {
    const { faces, pulls } = fronts(base('MV-B24-F'), 0)
    expect(faces).toHaveLength(2)
    expect(pulls).toHaveLength(2)
    for (const pull of pulls) expect(pull.height).toBeGreaterThan(pull.width)
  })

  it('gives a 15 inch base one door, pulled on its opening edge', () => {
    const { faces, pulls } = fronts(base('MV-B15', 15), 0)
    expect(faces).toHaveLength(1)
    expect(pulls[0].x).toBeGreaterThan(faces[0].x + faces[0].width / 2)
  })

  it('gives drawer bases one face and one level pull per drawer', () => {
    for (const [sku, count] of [['MV-DB24-3', 3], ['MV-DB24-4', 4]] as const) {
      const { faces, pulls } = fronts(base(sku), 0)
      expect(faces).toHaveLength(count)
      expect(pulls).toHaveLength(count)
      for (const pull of pulls) expect(pull.width).toBeGreaterThan(pull.height)
    }
  })

  it('keeps every face inside the cabinet, either way up', () => {
    const item = base('MV-DB24-3')
    for (const f of fronts(item, 0, 1).faces) {
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.y + f.height).toBeLessThanOrEqual(item.height)
    }
    const top = item.y + item.height
    for (const f of fronts(item, top, -1).faces) {
      expect(f.y).toBeLessThanOrEqual(top)
      expect(f.y - f.height).toBeGreaterThanOrEqual(item.y)
    }
  })

  it('mirrors exactly between page and floor coordinates', () => {
    const item = base('MV-DB24-4')
    const page = fronts(item, 0, 1).faces.map((f) => f.y)
    const floor = fronts(item, item.height, -1).faces.map((f) => item.height - f.y)
    floor.forEach((value, i) => expect(value).toBeCloseTo(page[i], 9))
  })
})

describe('drawerCount', () => {
  it('reads the drawer count off the SKU', () => {
    expect(drawerCount('MV-DB30-4')).toBe(4)
    expect(drawerCount('MV-B30-F')).toBe(0)
    expect(drawerCount('MV-BWB15-PS')).toBe(1)
  })
})
