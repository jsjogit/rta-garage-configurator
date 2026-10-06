import { describe, expect, it } from 'vitest'
import { cellKey, createGrid, addCell, readCell, snapCeiling, snapLength, GRID } from '../codec'
import type { SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'
import panel from '../../fixtures/two-car-panel.json'
import storage from '../../fixtures/storage-240.json'
import tipUp from '../../fixtures/tip-up-84.json'
import tooShort from '../../fixtures/too-short.json'

const fixtures = { vignette, panel, storage, tipUp, tooShort } as unknown as Record<string, SolveResponse>

describe('preview codec', () => {
  it.each(Object.keys(fixtures))('packs and unpacks %s exactly as the API returned it', (name) => {
    const grid = createGrid()
    addCell(grid, 240, 96, 'Workbench', fixtures[name])
    // Through JSON, as the page will carry it.
    const carried = JSON.parse(JSON.stringify(grid))
    expect(readCell(carried, 240, 96, 'Workbench')).toEqual(fixtures[name])
  })

  it('shares SKU names, prices and messages across cells instead of repeating them', () => {
    const grid = createGrid()
    addCell(grid, 240, 96, 'Workbench', fixtures.panel)
    const one = JSON.stringify(grid).length
    addCell(grid, 246, 96, 'Workbench', fixtures.panel)
    const two = JSON.stringify(grid).length
    expect(two - one).toBeLessThan(one * 0.8)
  })

  it('returns nothing for a wall that was never baked', () => {
    expect(readCell(createGrid(), 240, 96, 'Storage')).toBeNull()
  })

  it('keys cells by the snapped wall', () => {
    expect(cellKey(240, 96, 'Balanced')).toBe('240|96|Balanced')
  })
})

describe('snapping a typed wall to the baked grid', () => {
  it('rounds lengths to the nearest 6 inches, halves up', () => {
    expect(snapLength(240)).toBe(240)
    expect(snapLength(242)).toBe(240)
    expect(snapLength(243)).toBe(246)
    expect(snapLength(186)).toBe(186)
  })

  it('keeps lengths inside 6 to 30 feet', () => {
    expect(snapLength(40)).toBe(GRID.minLength)
    expect(snapLength(500)).toBe(GRID.maxLength)
    expect(GRID.minLength).toBe(72)
    expect(GRID.maxLength).toBe(360)
  })

  it('picks the nearest baked ceiling: 7, 8, 9 or 10 feet', () => {
    expect(GRID.ceilings).toEqual([84, 96, 108, 120])
    expect(snapCeiling(96)).toBe(96)
    expect(snapCeiling(100)).toBe(96)
    expect(snapCeiling(103)).toBe(108)
    expect(snapCeiling(130)).toBe(120)
    expect(snapCeiling(84)).toBe(84) // a low garage keeps its pantry warning
    expect(snapCeiling(70)).toBe(84)
  })
})
