import type { SolveResponse, WallDto } from './api/types'

import vignette from './fixtures/vignette-72.json'
import clean from './fixtures/single-car-clean.json'
import panel from './fixtures/two-car-panel.json'
import storage from './fixtures/storage-240.json'
import tipUp from './fixtures/tip-up-84.json'

const WALLS: Record<string, { response: unknown; wall: WallDto }> = {
  'vignette-72': { response: vignette, wall: { length: 72, ceiling: 96 } },
  'single-car-clean': { response: clean, wall: { length: 240, ceiling: 96 } },
  'two-car-panel': {
    response: panel,
    wall: {
      length: 240,
      ceiling: 96,
      obstructions: [{ type: 'ElectricalPanel', startX: 180, width: 16, height: 30, bottomY: 48 }],
    },
  },
  'storage-240': { response: storage, wall: { length: 240, ceiling: 96 } },
  'tip-up-84': { response: tipUp, wall: { length: 240, ceiling: 84 } },
}

/**
 * Dev only: ?demo=<fixture> renders a stored API payload so the UI can be worked on without the
 * Functions host running. Tree-shaken out of production by the import.meta.env.DEV guard at the
 * call site.
 */
export function demoFixture(): { response: SolveResponse; wall: WallDto } | null {
  const name = new URLSearchParams(window.location.search).get('demo')
  const found = name ? WALLS[name] : undefined

  return found ? { response: found.response as SolveResponse, wall: found.wall } : null
}
