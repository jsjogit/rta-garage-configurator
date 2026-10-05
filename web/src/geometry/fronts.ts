// web/src/geometry/fronts.ts
import type { PlacedItemDto } from '../api/types'

/*
  A cabinet's fronts — door or drawer faces and their bar pulls — as plain rectangles in inches. The
  SVG elevation and the 3D scene both draw from this, so the two views cannot disagree about how a
  cabinet is built.
*/

export const REVEAL = 0.75 // gap between adjacent fronts
export const PULL = { length: 0.45, thickness: 1.1 } // bar pull: fraction of face, inches thick

export interface Rect {
  x: number
  /** The edge nearest `top`: the upper edge, in whichever direction the caller's y runs. */
  y: number
  width: number
  height: number
}

/**
 * `top` is the cabinet's top edge in the caller's coordinates; `down` is +1 when y grows down the
 * page (SVG) and -1 when it grows up from the floor (3D). faces[i] and pulls[i] belong together.
 */
export function fronts(item: PlacedItemDto, top: number, down: 1 | -1 = 1): { faces: Rect[]; pulls: Rect[] } {
  const drawers = drawerCount(item.sku)
  const faces: Rect[] = []
  const pulls: Rect[] = []

  if (drawers > 0) {
    const each = (item.height - REVEAL * (drawers + 1)) / drawers

    for (let i = 0; i < drawers; i++) {
      const y = top + down * REVEAL + down * i * (each + REVEAL)
      faces.push({ x: item.x + REVEAL, y, width: item.width - REVEAL * 2, height: each })
      pulls.push({
        x: item.x + item.width / 2 - (item.width * PULL.length) / 2,
        y: y + down * (each / 2) - down * (PULL.thickness / 2),
        width: item.width * PULL.length,
        height: PULL.thickness,
      })
    }
    return { faces, pulls }
  }

  // A pair of doors from 24" up, otherwise a single door. Pulls sit at the opening edge.
  const pair = item.width >= 24
  const faceWidth = pair ? (item.width - REVEAL * 3) / 2 : item.width - REVEAL * 2
  const faceHeight = item.height - REVEAL * 2
  const pullHeight = Math.min(faceHeight * 0.4, 10)

  for (let i = 0; i < (pair ? 2 : 1); i++) {
    const x = item.x + REVEAL + i * (faceWidth + REVEAL)
    // Inner edge for a pair, the right edge for a single door.
    const pullX = pair ? (i === 0 ? x + faceWidth - 2.2 : x + 1.1) : x + faceWidth - 2.2
    faces.push({ x, y: top + down * REVEAL, width: faceWidth, height: faceHeight })
    pulls.push({
      x: pullX,
      y: top + down * (item.height / 2) - down * (pullHeight / 2),
      width: PULL.thickness,
      height: pullHeight,
    })
  }
  return { faces, pulls }
}

export function drawerCount(sku: string): number {
  if (sku.includes('-DB') || sku.startsWith('MV-DB')) {
    const match = sku.match(/-(\d)$/)
    return match ? Number(match[1]) : 3
  }
  return sku.includes('BWB') ? 1 : 0
}
