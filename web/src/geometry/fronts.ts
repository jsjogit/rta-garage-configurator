// web/src/geometry/fronts.ts
import type { PlacedItemDto } from '../api/types'

/*
  How each cabinet is built, as plain rectangles in inches, matched to the manufacturer's renders
  (assets/reference/sku-renders, measured 2026-10-06). The SVG elevation and the 3D scene both draw
  from this, so the two views cannot disagree about doors, drawers, pulls or legs.
*/

export const REVEAL = 0.75 // gap between adjacent fronts

/** Matte black square bar pull (MV-BP36570FB render). Inches. */
export const PULL = { length: 5, thickness: 0.6, edgeInset: 1.5, endInset: 2 }

/** Stainless adjustable legs, drawn at their lowest setting: 4" (they adjust to 6.25"). */
export const LEG = { height: 4, inset: 1.5, sleeveDiameter: 1.5, footDiameter: 1.1, sleeveShare: 0.55 }

/** The drawer over the doors of MV-B15, MV-B24, MV-B30 and MV-BWB15-PS. */
const TOP_DRAWER = 6
/** 3-drawer bases are graduated: short on top, deepest at the bottom (MV-DB24-3, MV-DB30-3). */
const THREE_DRAWER_SHARES = [0.22, 0.34, 0.44]
/** Pantries: a short upper pair over a tall lower pair (MV-PC2484, MV-PC3084). */
const PANTRY_UPPER_SHARE = 0.4

export interface Rect {
  x: number
  /** The edge nearest `top` (or `floor`), in whichever direction the caller's y runs. */
  y: number
  width: number
  height: number
}

export type FrontLayout = 'drawers' | 'drawerOverDoor' | 'drawerOverPair' | 'pair' | 'single' | 'pantry'

export function hasLegs(item: PlacedItemDto): boolean {
  return item.zone === 'Base' || item.zone === 'Tall'
}

/** The box itself; the listed height includes the legs. */
export function boxHeight(item: PlacedItemDto): number {
  return item.height - (hasLegs(item) ? LEG.height : 0)
}

/** Which front arrangement a cabinet has, from its zone and SKU pattern. New SKUs: extend here. */
export function frontLayoutOf(item: PlacedItemDto): FrontLayout {
  if (drawerCount(item.sku) > 0) return 'drawers'
  if (item.zone === 'Tall') return 'pantry'
  const pair = item.width >= 24
  if (item.zone === 'Base' && !item.sku.endsWith('-F')) return pair ? 'drawerOverPair' : 'drawerOverDoor'
  return pair ? 'pair' : 'single'
}

export function drawerCount(sku: string): number {
  const match = sku.match(/-DB\d+-(\d)$/)
  return match ? Number(match[1]) : 0
}

type PullAt = 'top' | 'bottom' | 'centre'
interface Row {
  fixed?: number
  share?: number
  kind: 'drawer' | 'doors'
  leaves: 1 | 2
  pull: PullAt
}

function rowsFor(item: PlacedItemDto): Row[] {
  const leaves = item.width >= 24 ? 2 : 1
  switch (frontLayoutOf(item)) {
    case 'drawers': {
      const n = drawerCount(item.sku)
      const shares = n === 3 ? THREE_DRAWER_SHARES : Array<number>(n).fill(1 / n)
      return shares.map((share) => ({ share, kind: 'drawer', leaves: 1, pull: 'centre' }))
    }
    case 'drawerOverDoor':
    case 'drawerOverPair':
      return [
        { fixed: TOP_DRAWER, kind: 'drawer', leaves: 1, pull: 'centre' },
        { share: 1, kind: 'doors', leaves, pull: 'top' },
      ]
    case 'pantry':
      return [
        { share: PANTRY_UPPER_SHARE, kind: 'doors', leaves, pull: 'bottom' },
        { share: 1 - PANTRY_UPPER_SHARE, kind: 'doors', leaves, pull: 'top' },
      ]
    default:
      return [{ share: 1, kind: 'doors', leaves, pull: item.zone === 'Wall' ? 'bottom' : 'top' }]
  }
}

/**
 * `top` is the cabinet's top edge in the caller's coordinates; `down` is +1 when y grows down the
 * page (SVG) and -1 when it grows up from the floor (3D). faces[i] and pulls[i] belong together.
 */
export function fronts(item: PlacedItemDto, top: number, down: 1 | -1 = 1): { faces: Rect[]; pulls: Rect[] } {
  const rows = rowsFor(item)
  const span = boxHeight(item) - REVEAL * (rows.length + 1)
  const flexible = span - rows.reduce((sum, row) => sum + (row.fixed ?? 0), 0)
  const faces: Rect[] = []
  const pulls: Rect[] = []

  let depth = REVEAL // distance below the top edge
  for (const row of rows) {
    const height = row.fixed ?? (row.share ?? 0) * flexible
    const leafWidth = (item.width - REVEAL * (row.leaves + 1)) / row.leaves

    for (let leaf = 0; leaf < row.leaves; leaf++) {
      const x = item.x + REVEAL + leaf * (leafWidth + REVEAL)
      faces.push({ x, y: top + down * depth, width: leafWidth, height })
      pulls.push(pullFor(row, leaf, x, leafWidth, depth, height, top, down))
    }
    depth += height + REVEAL
  }
  return { faces, pulls }
}

function pullFor(row: Row, leaf: number, x: number, width: number, depth: number, height: number, top: number, down: 1 | -1): Rect {
  if (row.kind === 'drawer') {
    return {
      x: x + width / 2 - PULL.length / 2,
      y: top + down * (depth + height / 2 - PULL.thickness / 2),
      width: PULL.length,
      height: PULL.thickness,
    }
  }

  // Doors open at the meeting edges of a pair, or on the right of a single door (hinged left, as rendered).
  const opening = row.leaves === 2 && leaf === 1 ? x + PULL.edgeInset : x + width - PULL.edgeInset
  const length = Math.min(PULL.length, height - 2 * PULL.endInset)
  const from =
    row.pull === 'top'
      ? depth + PULL.endInset
      : row.pull === 'bottom'
        ? depth + height - PULL.endInset - length
        : depth + height / 2 - length / 2

  return { x: opening - PULL.thickness / 2, y: top + down * from, width: PULL.thickness, height: length }
}

/** Leg centres seen from above: x along the wall, z out from the wall face. Four per floor cabinet. */
export function legPositions(item: PlacedItemDto): { x: number; z: number }[] {
  if (!hasLegs(item)) return []
  const r = LEG.sleeveDiameter / 2
  const xs = [item.x + LEG.inset + r, item.x + item.width - LEG.inset - r]
  const zs = [LEG.inset + r, item.depth - LEG.inset - r]
  return zs.flatMap((z) => xs.map((x) => ({ x, z })))
}

/** The front pair of legs as drawn in elevation: a sleeve, then a slimmer foot, for each. */
export function legRects(item: PlacedItemDto, floor: number, down: 1 | -1 = 1): Rect[] {
  const sleeve = LEG.height * LEG.sleeveShare
  return legPositions(item)
    .filter((leg) => leg.z > item.depth / 2)
    .flatMap((leg) => [
      { x: leg.x - LEG.sleeveDiameter / 2, y: floor - down * LEG.height, width: LEG.sleeveDiameter, height: sleeve },
      { x: leg.x - LEG.footDiameter / 2, y: floor - down * (LEG.height - sleeve), width: LEG.footDiameter, height: LEG.height - sleeve },
    ])
}
