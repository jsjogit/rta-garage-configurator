# Render Accuracy and 3D Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 2D drawing match the manufacturer's renders. That means legs, the right door and drawer layout for every SKU, the right pull positions and the right colors, plus product photos. Then, as optional version 1D, show the 3D view in a large pop-up, modeled to the renders' standard.

**Architecture:**
- **Shared description.** `web/src/geometry/fronts.ts` is the single description of how a cabinet is built (faces, pulls, legs). The SVG elevation and the 3D scene both read it.
- **Accuracy lands on `v1a`** and merges into 1B, 1C and 2.0.
- **Product photos** are static WebP files. A rerunnable script derives them from the reference renders. They never enter the JS bundle.
- **1D is a new branch from `v1c-3d`.** It adds a native `<dialog>` and richer procedural geometry: cylinders, U-shaped pulls, rounded boxes, shadows and lighting. It still has no model files, and Three.js stays only in `Wall3D.tsx`.

**Tech Stack:** React 18 + Vite 6 + TypeScript 5.7, Vitest 2 + Testing Library (jsdom), Three.js 0.186 (`RoundedBoxGeometry`, `RoomEnvironment` add-ons), `sharp` (web devDependency, build script only), Playwright MCP for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-06-render-accuracy-and-3d-quality-design.md`

## Global Constraints

- **No backend changes.** No changes to `src/`, `tests/`, the solver, the API or `data/catalog.json`. Layout heights stay as listed: base 34.5″, pantry 84″, wall 30″/15″.
- **Legs are drawn at their lowest setting, 4″.**
  - The box is 30.5″ for a base and 80″ for a pantry.
  - Legs go on zones `Base` and `Tall` only. `Wall`, `Filler`, `Counter` and `KneeSpace` get none.
- **Measured constants** (from `assets/reference/sku-renders`, 2026-10-06), recorded in `fronts.ts`:
  - top drawer 6″;
  - 3-drawer shares `[0.22, 0.34, 0.44]`;
  - pantry upper share `0.4`;
  - pull length 5″, thickness 0.6″, inset 1.5″ from the opening edge, 2″ from the door end;
  - leg inset 1.5″, sleeve Ø1.5″, foot Ø1.1″, sleeve share 0.55;
  - countertop render grain angle 28.1°.
- **Colors:**
  - `--slab: #787a7b`, `--slab-edge: #5f6264`;
  - `--steel: #c9ccce`, `--steel-edge: #9da1a4`;
  - `--wood: #dda06a`, `--wood-deep: #b07a45`;
  - `--ink` is unchanged.
- **Reference originals never enter git** (`assets/reference/` is ignored). Only `web/public/renders/*.webp`, `web/public/textures/*.webp` and `data/render-manifest.json` are committed.
- **Product image files:** `web/public/renders/<SKU>-96.webp` and `<SKU>-320.webp`. Images load lazily, with explicit width and height and alt text equal to the catalog name.
- **Bundle:** `check:bundle` must still pass on every branch that has it. Images and textures are static files, never imported.
- **1D only:**
  - the dialog takes ~90% of the viewport on desktop and is full-screen under 1024px;
  - it is a native `<dialog>`; Esc, the close button and a backdrop click all close it; focus returns to the opener;
  - `view_3d_opened` gains `surface: 'dialog'`.
- **Every task ends green:** `cd web && npm test -- --run`, `npx tsc -b`, `npm run build`. Then `git checkout -- web/tsconfig.tsbuildinfo` before committing.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The running planner uses the main checkout.** Work on other branches in worktrees under the session scratchpad (`$WT`), never by switching the main checkout away from the branch the planner serves, unless the planner is stopped.

## Review Focus

1. **Every pull and face of every catalog SKU stays inside its cabinet.** That includes the 15″-tall wall cabinets (W2415, IC-MW-W3015), where a 5″ bottom pull must still fit, and the 15″-wide drawer-over-door bases. Test in Task 2.
2. **Adjacent cabinets' legs never overlap, and legs stay within their own cabinet's width.** Under a counter run, the floor must show between cabinets. Test in Task 2.
3. **A SKU with no image** (knee space, unknown or future SKU) renders no `<img>` and no broken-image icon. Test in Task 5.
4. **The 3D dialog on the shared-design page** (one option, fixed tier) opens, shows that wall, and has no dead tier switch. Test in Task 8.
5. **Tier switch inside the dialog** updates the card behind it, and closing returns focus to "See it in 3D". Test in Task 8.

---

## File Structure

| Path | Branch | Status | Responsibility |
|---|---|---|---|
| `web/src/geometry/fronts.ts` | v1a | Create (cherry-pick), then modify | Front layouts, pulls, legs, box height: the single cabinet description |
| `web/src/geometry/__tests__/fronts.test.ts` | v1a | Create (cherry-pick), then modify | Per-layout and all-SKU tests |
| `web/src/components/Elevation.tsx` | v1a | Modify | Draws the box over the legs, the legs, and fronts from `fronts.ts` |
| `web/src/styles/tokens.css` | v1a | Modify | Colors from the renders |
| `data/render-manifest.json` | v1a | Create | Canonical SKU → reference filename |
| `web/scripts/build-renders.mjs` | v1a | Create | Originals → WebP thumbnails, `available.json`, wood texture |
| `web/src/renders/available.json` | v1a | Create (generated) | SKUs that have images |
| `web/src/components/SkuImage.tsx` | v1a | Create | `<img>` for a SKU, or nothing |
| `web/src/components/Results.tsx`, `CabinetPanel.tsx` | v1a | Modify | Photos in the parts table, the panel and swap options |
| `web/public/renders/*.webp`, `web/public/textures/butcher-block.webp` | v1a | Create (generated) | Derived assets |
| `web/src/three/buildScene.ts`, `Wall3D.tsx` | v1c → v1d | Modify | 1C: box over legs + leg boxes. 1D: cylinders, U pulls, rounded shapes, instancing, shadows, environment, textures |
| `web/src/components/ThreeDDialog.tsx` | v1d | Create | The pop-up |
| `README.md`, `docs/DECISIONS.md`, `docs/PLAN.md` | all | Modify | Docs |

**Workspace setup (run once before Task 1):**

```bash
ROOT=/Users/joshuasjogren/ClaudeCode/Garage-Project/rta-garage-configurator
WT=/private/tmp/claude-502/-Users-joshuasjogren-ClaudeCode-Garage-Project-rta-garage-configurator/37e5cfc2-f36a-47d9-b0da-266b58f84abc/scratchpad/wt
git -C $ROOT worktree list   # if $WT/v1a is absent: git -C $ROOT worktree add $WT/v1a v1a
cd $WT/v1a/web && npm ci
```

All of Tasks 1–5 run in `$WT/v1a`.

---

## Part 1 — Accuracy on `v1a`

### Task 1: Bring the shared fronts module to `v1a`

**Files:**
- Create (cherry-pick of `047decc`): `web/src/geometry/fronts.ts`, `web/src/geometry/__tests__/fronts.test.ts`
- Modify (same cherry-pick): `web/src/components/Elevation.tsx`

**Interfaces:**
- Produces, as on 1C: `REVEAL`, `PULL`, `Rect`, `fronts(item, top, down = 1)`, `drawerCount(sku)`.

- [ ] **Step 1: Cherry-pick the pure refactor**

```bash
cd $WT/v1a && git cherry-pick -x 047decc
```

Expected: applies cleanly. It touches `Elevation.tsx` and adds `web/src/geometry/`.

- [ ] **Step 2: Prove nothing visible changed**

Run: `cd web && npm test -- --run && npx tsc -b && git status --short`
Expected:
- all tests pass (91 + 6 fronts tests = 97);
- `git status` shows no change under `__snapshots__`.

- [ ] **Step 3: Commit is the cherry-pick itself.** Nothing further. Record it in the ledger.

---

### Task 2: Front layouts, pulls and legs in `fronts.ts`

**Files:**
- Modify: `web/src/geometry/fronts.ts` (rewrite)
- Modify: `web/src/geometry/__tests__/fronts.test.ts` (rewrite)

**Interfaces:**
- Consumes: `PlacedItemDto`.
- Produces:
  - `REVEAL = 0.75`
  - `PULL = { length: 5, thickness: 0.6, edgeInset: 1.5, endInset: 2 }`
  - `LEG = { height: 4, inset: 1.5, sleeveDiameter: 1.5, footDiameter: 1.1, sleeveShare: 0.55 }`
  - `interface Rect { x; y; width; height }`. `y` is the edge nearest `top` (or `floor`).
  - `type FrontLayout = 'drawers' | 'drawerOverDoor' | 'drawerOverPair' | 'pair' | 'single' | 'pantry'`
  - `frontLayoutOf(item): FrontLayout`
  - `hasLegs(item): boolean`
  - `boxHeight(item): number`
  - `fronts(item, top, down: 1 | -1 = 1): { faces: Rect[]; pulls: Rect[] }`. `faces[i]` pairs with `pulls[i]`; faces stay within the box (`boxHeight`).
  - `legPositions(item): { x: number; z: number }[]`. Plan-view centres: x along the wall, z out from the wall face. Four per floor-standing cabinet, none otherwise.
  - `legRects(item, floor, down: 1 | -1 = 1): Rect[]`. The front pair as drawn in elevation, sleeve then foot for each leg.
  - `drawerCount(sku): number`. The number of drawers in a drawer-only stack: `MV-DB24-3` → 3, anything else → 0.

- [ ] **Step 1: Write the failing tests** (replace the file)

```ts
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
```

- [ ] **Step 2: Run, and confirm the tests fail**

Run: `cd web && npx vitest run src/geometry`
Expected: FAIL. `frontLayoutOf`, `hasLegs`, `boxHeight`, `legPositions`, `legRects` and `LEG` are not exported.

This test imports `data/catalog.json` from outside `web/`. If `npx tsc -b` later reports it as outside the project, add `"../data/*.json"` to `include` in `web/tsconfig.json`. Vitest itself resolves it either way.

- [ ] **Step 3: Rewrite `fronts.ts`**

```ts
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
```

- [ ] **Step 4: Run, and confirm the tests pass**

Run: `cd web && npx vitest run src/geometry`
Expected: PASS. The `it.each` rows plus the other tests are all green.

- [ ] **Step 5: Run the whole suite.** The Elevation snapshots are expected to fail now; they are regenerated deliberately in Task 3, after the browser comparison.

Run: `cd web && npx vitest run 2>&1 | tail -5`
Expected:
- fronts tests pass;
- Elevation snapshot tests fail (the fronts changed);
- nothing else fails.

**Do not commit yet.** Task 3 completes the drawing, and they commit together as the first green state.

---

### Task 3: The drawing stands on legs, in the renders' colors

**Files:**
- Modify: `web/src/components/Elevation.tsx` (`ItemBody` default branch)
- Modify: `web/src/styles/tokens.css`
- Modify: `web/src/components/__tests__/Elevation.test.tsx` (new tests; regenerated snapshots)

**Interfaces:**
- Consumes: `boxHeight`, `legRects`, `fronts` from Task 2.

- [ ] **Step 1: Add the failing Elevation tests.** Append inside `describe('Elevation', …)`:

```tsx
  it('stands base cabinets on stainless legs with the floor showing between them', () => {
    const svg = svgFor('vignette-72')
    const legs = [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'var(--steel)')
    // Two MV-B24-F bases; the front pair of each, a sleeve and a foot per leg.
    expect(legs).toHaveLength(8)
    for (const leg of legs) expect(Number(leg.getAttribute('y')) + Number(leg.getAttribute('height'))).toBeLessThanOrEqual(96 + 1e-9)
    const bodies = [...svg.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('fill') === 'var(--slab)' && Number(r.getAttribute('height')) === 30.5,
    )
    expect(bodies).toHaveLength(2) // the box stops 4" above the floor
  })

  it('draws a drawer over the doors of an MV-B15', () => {
    const layout = { items: [{ sku: 'MV-B15', x: 0, y: 0, width: 15, height: 34.5, depth: 24, zone: 'Base' as const }] }
    const { container } = render(<Elevation layout={layout} wallLength={15} ceiling={96} id="b15" />)
    const pulls = [...container.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'var(--ink)')
    expect(pulls).toHaveLength(2)
    const [drawer, door] = pulls
    expect(Number(drawer.getAttribute('width'))).toBeGreaterThan(Number(drawer.getAttribute('height'))) // level drawer pull
    expect(Number(door.getAttribute('height'))).toBeGreaterThan(Number(door.getAttribute('width'))) // upright door pull
  })

  it('draws a pantry as four doors', () => {
    const layout = { items: [{ sku: 'MV-PC3084', x: 0, y: 0, width: 30, height: 84, depth: 24, zone: 'Tall' as const }] }
    const { container } = render(<Elevation layout={layout} wallLength={30} ceiling={96} id="pc" />)
    expect([...container.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'var(--ink)')).toHaveLength(4)
  })
```

- [ ] **Step 2: Run, and confirm they fail**

Run: `cd web && npx vitest run src/components/__tests__/Elevation.test.tsx -t "legs|MV-B15|pantry"`
Expected: FAIL. There are no `var(--steel)` rects yet, and the body height is still 34.5. (The B15 and pantry tests may already pass, because Task 2 changed `fronts`; that's fine, they guard the drawing.)

- [ ] **Step 3: Draw the box over the legs.** In `Elevation.tsx`:
  - import `boxHeight` and `legRects` alongside `fronts`;
  - replace the final `return` of `ItemBody` (the default cabinet branch) with:

```tsx
  // The listed height includes the legs: the box stops short of the floor and the legs carry it.
  const floorY = toY(item.y)
  return (
    <g>
      <rect x={item.x} y={y} width={item.width} height={boxHeight(item)} fill="var(--slab)" stroke="var(--slab-edge)" strokeWidth="0.5" />
      <Fronts item={item} top={y} />
      {legRects(item, floorY).map((leg, i) => (
        <rect key={`leg${i}`} x={leg.x} y={leg.y} width={leg.width} height={leg.height} fill="var(--steel)" stroke="var(--steel-edge)" strokeWidth="0.2" />
      ))}
    </g>
  )
```

- [ ] **Step 4: Colors from the renders.** In `web/src/styles/tokens.css`, replace the product-color block with:

```css
  /* Product colours, sampled from the manufacturer's renders (2026-10-06). Not brand chrome. */
  --slab: #787a7b;
  --slab-edge: #5f6264;
  --steel: #c9ccce;
  --steel-edge: #9da1a4;
  --ink: #15171a;
  --wood: #dda06a;
  --wood-deep: #b07a45;
```

- [ ] **Step 5: Run the new tests**

Run: `cd web && npx vitest run src/components/__tests__/Elevation.test.tsx -t "legs|MV-B15|pantry"`
Expected: PASS.

- [ ] **Step 6: Compare against the renders before accepting the snapshots.**
  1. Start the web dev server from `$WT/v1a/web` on a spare port: `npx vite --port 5174 --strictPort`. Run it in the background, since the main checkout's planner may be on 5173.
  2. Open `http://localhost:5174/?demo=two-car-panel` and `?demo=vignette-72` (both tiers) at 1366 × 900.
  3. Screenshot the drawings, and place them beside `MV-B24-F`, `MV-B15 … Left`, `MV-DB30-3`, `MV-PC3084` and `MV-W2430` from the `renders/` previews.
  4. Check: legs visible and proportionate; drawer over door on B15; pulls at the top of base doors and the bottom of wall doors; pantry with four doors; darker gray; amber counter.
  5. If a measured constant reads wrong, adjust it in `fronts.ts` with a ledger ruling, and re-run Task 2's tests.

- [ ] **Step 7: Regenerate the snapshots deliberately**

Run: `cd web && npx vitest run -u src/components/__tests__/Elevation.test.tsx && npm test -- --run && npx tsc -b && npm run build`
Expected: snapshots updated; everything green.

- [ ] **Step 8: Commit (Tasks 2 and 3 together)**

```bash
cd $WT/v1a && git checkout -- web/tsconfig.tsbuildinfo
git add web/src
git commit -m "Drawing matches the manufacturer's renders: legs, front layouts, pulls, colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Derived product images from the reference renders

**Files:**
- Create: `data/render-manifest.json`
- Create: `web/scripts/build-renders.mjs`
- Modify: `web/package.json` (`sharp` devDependency; `build:renders` script)
- Create (generated, committed): `web/public/renders/*.webp`, `web/public/textures/butcher-block.webp`, `web/src/renders/available.json`
- Test: `web/src/renders/__tests__/manifest.test.ts`

**Interfaces:**
- Produces:
  - `web/src/renders/available.json`: `string[]`, the sorted SKUs that have images;
  - the URL pattern `${import.meta.env.BASE_URL}renders/<SKU>-<96|320>.webp`.

- [ ] **Step 1: Write the manifest**

```json
{
  "_meta": "Canonical catalog SKU -> manufacturer render in assets/reference/sku-renders (not in git). Rebuild with: cd web && npm run build:renders",
  "renders": {
    "MV-B15": "MV-B15 1 Door 1 Drawer_Left_RT.png",
    "MV-B24": "MV-B24 2 Door_RT.png",
    "MV-B24-F": "MV-B24-F 2 Door_RT.png",
    "MV-B30": "MV-B30 2 Door 1 Drawer_RT.png",
    "MV-B30-F": "MV-B30-F 2 Door_RT.png",
    "MV-BWB15-PS": "MV-BWB15-PS_RT.png",
    "MV-DB24-3": "MV-DB24-3_RT.png",
    "MV-DB24-4": "MV-DB24-4_RT.png",
    "MV-DB30-3": "MV-DB30-3_RT.png",
    "MV-DB30-4": "MV-DB30-4_RT.png",
    "MV-PC2484": "MV-PC2484_RT.png",
    "MV-PC3084": "MV-PC3084_RT.png",
    "MV-W1530": "MV-W1530-1 Door_RT.png",
    "MV-W2415": "MV-W2415-2 Door_RT.png",
    "MV-W2430": "MV-W2430 2 Door_RT.png",
    "MV-W3030": "MV-W3030-2 Door_RT.png",
    "IC-MW-W3015": "MV-W3015-2 Door_RT.png",
    "MV-F384": "MV-F384_RT.png",
    "MV-CTHW5025": "MV-CTHW5025_RT.png",
    "MV-CTHW7425": "MV-CTHW7425_RT.png",
    "MV-CTHW9825": "MV-CTHW9825_RT.png"
  },
  "texture": { "butcherBlock": { "from": "MV-CTHW9825_RT.png", "grainAngleDegrees": 28.1 } }
}
```

- [ ] **Step 2: Write the failing coverage test**

```ts
// web/src/renders/__tests__/manifest.test.ts
import { describe, expect, it } from 'vitest'
import catalog from '../../../../data/catalog.json'
import manifest from '../../../../data/render-manifest.json'
import available from '../available.json'

const skus = [
  ...(catalog as { cabinets: { sku: string }[] }).cabinets.map((c) => c.sku),
  ...(catalog as { countertops: { sku: string }[] }).countertops.map((c) => c.sku),
]

describe('product images', () => {
  it('has a reference render for every catalog cabinet and countertop', () => {
    const missing = skus.filter((sku) => !(sku in manifest.renders))
    expect(missing).toEqual([])
  })

  it('has built images for every SKU in the manifest', () => {
    expect([...available].sort()).toEqual(Object.keys(manifest.renders).sort())
  })
})
```

Run: `cd web && npx vitest run src/renders`
Expected: FAIL — `../available.json` does not exist.

- [ ] **Step 3: Write the build script and add `sharp`**

Run: `cd web && npm install -D sharp`

```js
// web/scripts/build-renders.mjs
// Derives web-size product images and the butcher-block texture from the manufacturer's renders.
// The originals live in assets/reference/sku-renders (not in git); rerun after they change.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const root = new URL('../../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('data/render-manifest.json', root), 'utf8'))
const source = (file) => new URL(`assets/reference/sku-renders/${file}`, root).pathname
const out = (path) => new URL(`web/public/${path}`, root).pathname

mkdirSync(out('renders'), { recursive: true })
mkdirSync(out('textures'), { recursive: true })

for (const [sku, file] of Object.entries(manifest.renders)) {
  // Trim the white studio border so every thumbnail fills its box the same way.
  const trimmed = await sharp(source(file)).trim({ background: '#ffffff', threshold: 12 }).toBuffer()
  for (const size of [96, 320]) {
    await sharp(trimmed)
      .resize(size, size, { fit: 'contain', background: '#ffffff' })
      .webp({ quality: 82 })
      .toFile(out(`renders/${sku}-${size}.webp`))
  }
  console.log(`renders/${sku}`)
}

// The countertop render is a 3/4 view; rotate so its strips run level, then cut a band from the top.
const tex = manifest.texture.butcherBlock
const level = await sharp(source(tex.from))
  .rotate(tex.grainAngleDegrees, { background: '#ffffff' })
  .toBuffer({ resolveWithObject: true })
const { width, height } = level.info
await sharp(level.data)
  .extract({ left: Math.round(width * 0.3), top: Math.round(height * 0.42), width: Math.round(width * 0.4), height: Math.round(height * 0.08) })
  .resize(512, 128, { fit: 'fill' })
  .webp({ quality: 82 })
  .toFile(out('textures/butcher-block.webp'))
console.log('textures/butcher-block')

writeFileSync(new URL('web/src/renders/available.json', root), JSON.stringify(Object.keys(manifest.renders).sort(), null, 2) + '\n')
console.log('src/renders/available.json')
```

In `web/package.json` scripts, add: `"build:renders": "node scripts/build-renders.mjs"`.

The reference originals are in the **main checkout only** (they're ignored by git). Point the worktree at them before running:

```bash
mkdir -p $WT/v1a/assets/reference && ln -sfn $ROOT/assets/reference/sku-renders $WT/v1a/assets/reference/sku-renders
cd $WT/v1a/web && npm run build:renders
```

Expected: 21 `renders/…` lines, then `textures/butcher-block`, then `src/renders/available.json`.

- [ ] **Step 4: Check the outputs**

Run: `cd $WT/v1a/web && ls public/renders | wc -l && du -ch public/renders/*.webp | tail -1 && du -h public/textures/butcher-block.webp`
Expected:
- 42 files;
- total under ~1.7 MB (≤ 40 KB each);
- the texture under ~80 KB.

Open three thumbnails and the texture (Read tool):
- the cabinets are centred with the border trimmed;
- the texture shows level strips with no white corners.

If the texture band catches background, adjust the `extract` fractions with a ledger ruling and rerun.

- [ ] **Step 5: Run the test**

Run: `cd web && npx vitest run src/renders`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit (outputs included; the symlink stays untracked under the ignored `assets/reference/`)**

```bash
cd $WT/v1a && git status --short | grep -v '^??' ; git checkout -- web/tsconfig.tsbuildinfo
git add data/render-manifest.json web/scripts/build-renders.mjs web/package.json web/package-lock.json web/public/renders web/public/textures web/src/renders
git commit -m "Product images and wood texture derived from the manufacturer's renders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Product photos in the parts table and cabinet panel

**Files:**
- Create: `web/src/components/SkuImage.tsx`
- Modify: `web/src/components/Results.tsx` (parts table `desc` cell)
- Modify: `web/src/components/CabinetPanel.tsx` (header, swap options)
- Modify: `web/src/styles.css`
- Test: `web/src/components/__tests__/SkuImage.test.tsx`

**Interfaces:**
- Consumes: `web/src/renders/available.json` (Task 4).
- Produces: `SkuImage({ sku, alt, size }: { sku: string; alt: string; size: 96 | 320 }) => JSX.Element | null`.

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/components/__tests__/SkuImage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SkuImage } from '../SkuImage'
import { Results } from '../Results'
import type { SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'

describe('SkuImage', () => {
  it('shows the product image, lazily, with its size fixed so the page does not jump', () => {
    render(<SkuImage sku="MV-B24-F" alt="Full Height Door Base Cabinet" size={96} />)
    const img = screen.getByRole('img', { name: 'Full Height Door Base Cabinet' })
    expect(img.getAttribute('src')).toMatch(/renders\/MV-B24-F-96\.webp$/)
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('width')
    expect(img).toHaveAttribute('height')
  })

  it('shows nothing for a SKU without an image, rather than a broken one', () => {
    const { container } = render(<SkuImage sku="MV-NOT-A-SKU" alt="Mystery" size={96} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows nothing for a knee space', () => {
    const { container } = render(<SkuImage sku="" alt="Open knee space" size={96} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('product images in the results', () => {
  it('puts a photo beside every line in the parts table', () => {
    render(<Results response={vignette as SolveResponse} wall={{ length: 72, ceiling: 96 }} onStartOver={vi.fn()} />)
    const sheet = screen.getAllByRole('article')[0]
    const rows = within(sheet).getAllByRole('row').slice(1, -2) // skip the header and footer rows
    for (const row of rows) expect(within(row).getByRole('img')).toBeInTheDocument()
  })

  it('shows a larger photo of the selected cabinet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sku: 'MV-B24-F', options: [] }) }) as Response))
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={{ length: 72, ceiling: 96 }} onStartOver={vi.fn()} />)
    const sheet = screen.getAllByRole('article')[0]
    await user.click(within(sheet).getByRole('button', { name: /edit this wall/i }))
    await user.click(within(sheet).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0])
    const panel = within(sheet).getByRole('region', { name: 'Selected cabinet' })
    expect(within(panel).getByRole('img').getAttribute('src')).toMatch(/MV-B24-F-320\.webp$/)
    vi.unstubAllGlobals()
  })
})
```

Run: `cd web && npx vitest run src/components/__tests__/SkuImage.test.tsx`
Expected: FAIL — `../SkuImage` does not resolve.

- [ ] **Step 2: Implement `SkuImage`**

```tsx
// web/src/components/SkuImage.tsx
import available from '../renders/available.json'

const HAS_IMAGE = new Set<string>(available)

/** The manufacturer's render of a SKU, or nothing when there isn't one (knee space, a new SKU). */
export function SkuImage({ sku, alt, size }: { sku: string; alt: string; size: 96 | 320 }) {
  if (!HAS_IMAGE.has(sku)) return null
  const shown = size === 96 ? 40 : 140
  return (
    <img
      className={`sku-image sku-image-${size}`}
      src={`${import.meta.env.BASE_URL}renders/${sku}-${size}.webp`}
      alt={alt}
      width={shown}
      height={shown}
      loading="lazy"
      decoding="async"
    />
  )
}
```

- [ ] **Step 3: Wire it in.**
  - **`Results.tsx` parts table:** import `SkuImage`, then change the description cell to:

```tsx
                  <td className="desc">
                    <SkuImage sku={line.sku} alt={line.name} size={96} />
                    {line.name}
                  </td>
```

  - **`CabinetPanel.tsx`:** import `SkuImage`.
    - Inside the first `<div>` of the editor region, before `<h4>`, add:

```tsx
        {!isKnee && <SkuImage sku={item.sku} alt={line?.name ?? item.sku} size={320} />}
```

    - In each swap button, before `<span>{option.sku || 'Open knee space'}</span>`, add:

```tsx
                <SkuImage sku={option.sku} alt={option.name} size={96} />
```

- [ ] **Step 4: Style.** Append to `web/src/styles.css`:

```css
/* Manufacturer renders beside each SKU: small in the parts table, larger in the cabinet panel. */
.sku-image { display: block; object-fit: contain; background: #fff; border-radius: 4px; }
.parts-table .desc .sku-image { float: left; margin: 0 10px 2px 0; }
.editor .sku-image-320 { float: right; margin: 0 0 8px 12px; border: 1px solid var(--color-rule); }
.editor .swap .sku-image { width: 32px; height: 32px; }
```

- [ ] **Step 5: Run the tests and the suite**

Run: `cd web && npx vitest run src/components/__tests__/SkuImage.test.tsx && npm test -- --run && npx tsc -b && npm run build`
Expected:
- 5 new tests pass;
- the suite is green;
- the build passes, and the entry chunk is unchanged apart from `available.json` (a few hundred bytes).

- [ ] **Step 6: Browser check**
  1. From the v1a worktree dev server (Task 3 Step 6), open `?demo=two-car-panel` at 1366 and at 390.
  2. Thumbnails sit beside each parts line with no layout jump.
  3. On a phone the table still fits (`scrollWidth <= innerWidth`).
  4. Edit mode: the panel shows the large photo, and swap options show small ones.

- [ ] **Step 7: Commit**

```bash
cd $WT/v1a && git checkout -- web/tsconfig.tsbuildinfo
git add web/src
git commit -m "Product photos beside every SKU in the parts table and cabinet panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Carry the accuracy into 1B, 1C and 2.0

**Files:**
- `v1c-3d`: `web/src/three/buildScene.ts`, `web/src/three/Wall3D.tsx`, `web/src/three/__tests__/buildScene.test.ts`
- All branches: `docs/DECISIONS.md` (merge resolution)

**Interfaces:**
- Consumes: `boxHeight`, `legPositions`, `LEG` (Task 2).
- Produces on `v1c-3d`: `MaterialKey` gains `'leg'`. `itemBoxes` raises the carcass onto the legs and adds one `leg` box per leg.

- [ ] **Step 1: Merge `v1a` into `v1b-reorder`** in a worktree. Resolve `docs/DECISIONS.md` by keeping both sides.

```bash
git -C $ROOT worktree add $WT/v1b v1b-reorder && cd $WT/v1b && git merge --no-ff -m "Merge v1a: render accuracy and product photos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" v1a
```

Then: `cd web && npm ci && npm test -- --run && npx tsc -b && npm run build`
Expected: green.

**Rule:** if `Elevation.tsx` conflicts (1B's drag code and v1a's legs touch `Item` and `ItemBody` respectively), keep both: 1B's `Item` and v1a's `ItemBody`.

Commit the merge.

- [ ] **Step 2: Merge `v1a` into `v1c-3d`** (worktree `$WT/v1c`).

```bash
git -C $ROOT worktree add $WT/v1c v1c-3d && cd $WT/v1c && git merge --no-ff -m "Merge v1a: render accuracy and product photos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" v1a
```

`fronts.ts` arrives identical on both sides through the cherry-pick, then v1a's rewrite. Expect at most a `DECISIONS.md` conflict; keep both sides.

- [ ] **Step 3: Write the failing 3D leg tests on `v1c-3d`.** Append to `web/src/three/__tests__/buildScene.test.ts`:

```ts
describe('legs in 3D', () => {
  it('raises a base box onto four legs that reach the floor', () => {
    const boxes = one({ sku: 'MV-B24-F', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' })
    const carcass = of(boxes, 'carcass')[0]
    expect(carcass.y).toBeCloseTo(4, 9)
    expect(carcass.h).toBeCloseTo(30.5, 9)
    const legs = of(boxes, 'leg')
    expect(legs).toHaveLength(4)
    for (const leg of legs) {
      expect(leg.y).toBe(0)
      expect(leg.h).toBe(4)
    }
  })

  it('gives wall cabinets no legs', () => {
    expect(of(one({ sku: 'MV-W2430', x: 0, y: 54, width: 24, height: 30, depth: 12, zone: 'Wall' }), 'leg')).toHaveLength(0)
  })
})
```

Run: `cd $WT/v1c/web && npm ci && npx vitest run src/three`
Expected: FAIL. There is no `leg` material, and the carcass sits at y = 0.

- [ ] **Step 4: Implement on `v1c-3d`.** In `buildScene.ts`:
  - add `'leg'` to `MaterialKey`;
  - import `boxHeight`, `legPositions`, `LEG` from `../geometry/fronts`;
  - in `itemBoxes`, replace the carcass line and append legs:

```ts
  const lift = item.height - boxHeight(item) // the legs, or 0
  const { faces, pulls } = fronts(item, item.y + item.height, -1)

  return [
    { material: 'carcass', x: item.x, y: item.y + lift, z: 0, w: item.width, h: boxHeight(item), d: carcassDepth },
    ...faces.map((f): Box => ({ material: 'front', x: f.x, y: f.y - f.height, z: carcassDepth, w: f.width, h: f.height, d: FRONT_THICKNESS })),
    ...pulls.map((p): Box => ({ material: 'pull', x: p.x, y: p.y - p.height, z: item.depth, w: p.width, h: p.height, d: PULL_PROUD })),
    ...legPositions(item).map((leg): Box => ({
      material: 'leg',
      x: leg.x - LEG.sleeveDiameter / 2,
      y: item.y,
      z: leg.z - LEG.sleeveDiameter / 2,
      w: LEG.sleeveDiameter,
      h: LEG.height,
      d: LEG.sleeveDiameter,
    })),
  ]
```

  In `Wall3D.tsx`, update `MATERIALS` to the sampled colors and add the leg:

```ts
  carcass: { color: 0x6f7273, roughness: 0.8 },
  front: { color: 0x787a7b, roughness: 0.7 },
  pull: { color: 0x15171a, roughness: 0.4, metalness: 0.2 },
  counter: { color: 0xdda06a, roughness: 0.7 },
  leg: { color: 0xc9ccce, roughness: 0.3, metalness: 0.8 },
```

Run: `npx vitest run src/three && npm test -- --run && npx tsc -b && npm run build && npm run check:bundle`
Expected: green; the entry chunk is within 58,200.

Commit: `"1C: 3D cabinets stand on legs, in the renders' colours"`.

- [ ] **Step 5: Merge into `v2.0`.** The main checkout serves the planner from `v2.0`; stop the dev server first, or do this in a worktree.

```bash
git -C $ROOT worktree add $WT/v20 v2.0 2>/dev/null || true
cd $WT/v20 && git merge --no-ff -m "2.0: merge v1a render accuracy" v1a && git merge --no-ff -m "2.0: merge 1B" v1b-reorder && git merge --no-ff -m "2.0: merge 1C legs" v1c-3d
```

Resolve `DECISIONS.md` by keeping both sides. For `Elevation.tsx`/`Results.tsx`, keep both sides as in Phase 2's merge (onReorder stays on the drawing inside the 3D toggle).

Then: `cd web && npm ci && npm test -- --run && npx tsc -b && npm run build && npm run check:bundle`
Expected: green, and the entry chunk ≤ 58,400.

- [ ] **Step 6: Push and check CI**

```bash
for b in v1a v1b-reorder v1c-3d v2.0; do git -C $ROOT -c credential.helper= -c "credential.helper=!$HOME/.local/bin/gh auth git-credential" push origin $b; done
```

Expected: all three PRs green (`gh pr checks 1|2|3 -R jsjogit/rta-garage-configurator`).

---

## Part 2 — 1D on `v1d-3d-quality` (from `v1c-3d`)

**Setup:** `git -C $ROOT worktree add -b v1d-3d-quality $WT/v1d v1c-3d && cd $WT/v1d/web && npm ci`

### Task 7: The 3D pop-up

**Files:**
- Create: `web/src/components/ThreeDDialog.tsx`
- Modify: `web/src/components/Results.tsx` (`Sheet`: the drawing always shows; the toggle opens the dialog)
- Modify: `web/src/three/Wall3D.tsx` (fill the container's height when it has one)
- Modify: `web/src/test-setup.ts` (dialog polyfill)
- Modify: `web/src/styles.css`
- Test: `web/src/components/__tests__/ThreeD.test.tsx` (rewrite for the dialog)

**Interfaces:**
- Consumes: `Wall3D` (lazy), `ThreeBoundary`, `hasWebGL`, `track`.
- Produces: `ThreeDDialog(props: { open: boolean; onClose: () => void; title: string; total: string; tierSwitch: ReactNode; children: ReactNode })`.

- [ ] **Step 1: Polyfill `<dialog>` for jsdom.** Append to `web/src/test-setup.ts`:

```ts
// jsdom implements <dialog> but not showModal/close. Enough of both for components to work.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
```

- [ ] **Step 2: Rewrite the 3D tests for the dialog.** Replace the `describe('See it in 3D', …)` body in `ThreeD.test.tsx`. Keep its existing mocks (`state`, `vi.mock` of `support` and `Wall3D`), its `fetch` stub, and the helpers `firstSheet` and `show`.

```tsx
const dialog = () => screen.getByRole('dialog')

describe('See it in 3D', () => {
  it('opens a large pop-up and leaves the drawing in the card', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(dialog()).findByTestId('wall3d')).toBeInTheDocument()
    expect(within(firstSheet()).getByRole('img', { name: /front elevation/i })).toBeInTheDocument()
    expect(within(dialog()).getByRole('heading', { name: /recommended/i })).toBeInTheDocument()
  })

  it('switches tier from inside the pop-up, and the card follows', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(dialog()).findByTestId('wall3d')

    await user.click(within(dialog()).getByRole('button', { name: /premiere/i }))

    expect(within(dialog()).getByTestId('wall3d').dataset.skus).toContain('MV-DB24')
    expect(within(firstSheet()).getByRole('button', { name: /premiere/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('closes from its close button and gives focus back to the button that opened it', async () => {
    const user = userEvent.setup()
    show()
    const opener = within(firstSheet()).getByRole('button', { name: 'See it in 3D' })
    await user.click(opener)
    await within(dialog()).findByTestId('wall3d')

    await user.click(within(dialog()).getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(dialog()).findByTestId('wall3d')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is not offered without WebGL', () => {
    state.webgl = false
    show()
    expect(within(firstSheet()).queryByRole('button', { name: 'See it in 3D' })).not.toBeInTheDocument()
  })

  it('closes with a note in the card if the 3D view fails', async () => {
    state.explode = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(firstSheet()).findByText('We couldn’t show this wall in 3D on this device.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('works on a shared design, with no tier switch to fake', async () => {
    const user = userEvent.setup()
    const saved = solved.options[0].premiere
    show({ options: [{ label: 'Your saved wall', standard: saved, premiere: saved }], failure: null, notices: [] })

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect((await within(dialog()).findByTestId('wall3d')).dataset.skus).toContain('MV-DB24')
    expect(within(dialog()).queryByRole('group', { name: /cabinet tier/i })).not.toBeInTheDocument()
  })

  it('records the pop-up in the funnel', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(events).toContainEqual(
      expect.objectContaining({ name: 'view_3d_opened', properties: { rank: '0', tier: 'Standard', surface: 'dialog' } }),
    )
  })
})
```

Run: `cd web && npx vitest run src/components/__tests__/ThreeD.test.tsx`
Expected: FAIL — no `dialog` role.

- [ ] **Step 3: Implement `ThreeDDialog`**

```tsx
// web/src/components/ThreeDDialog.tsx
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The 3D view at a size worth looking at: a native <dialog>, so focus is trapped, Escape closes it
 * and the page behind is inert without any of that being re-implemented here.
 */
export function ThreeDDialog({
  open,
  onClose,
  title,
  total,
  tierSwitch,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  total: string
  tierSwitch: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className="three-d-dialog"
      aria-labelledby="three-d-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself, not its contents.
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header className="three-d-head">
        <h2 id="three-d-title">{title}</h2>
        {tierSwitch}
        <span className="three-d-total">{total}</span>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close 3D view">
          Close
        </button>
      </header>
      <div className="three-d-body">{children}</div>
    </dialog>
  )
}
```

- [ ] **Step 4: Rewire `Sheet` in `Results.tsx`.** The card always shows the `Elevation`: remove the inline `threeD ? … : …` branch and keep the plain `<Elevation …/>` exactly as before 1C. Then:

```tsx
  const opener = useRef<HTMLButtonElement>(null)
  const tierButtons = (
    <div className="tier-switch" role="group" aria-label="Cabinet tier">
      {(['Standard', 'Premiere'] as Tier[]).map((name) => (
        <button
          type="button"
          key={name}
          aria-pressed={tier === name}
          onClick={() => {
            setTier(name)
            onTouch()
          }}
        >
          {name}
        </button>
      ))}
    </div>
  )
```

  Use `{!fixedTier && tierButtons}` where the card's tier switch was, and add `useRef` to the React import.

  Replace the toggle button and add the dialog. Both go inside `<div className="drawing">`, after `<Elevation/>`:

```tsx
          {threeDFailed && (
            <p className="dims" role="status">
              We couldn’t show this wall in 3D on this device.
            </p>
          )}

          {webgl && !threeDFailed && (
            <button
              ref={opener}
              type="button"
              className="linklike"
              onClick={() => {
                track('view_3d_opened', configId, { rank: String(rank), tier, surface: 'dialog' })
                setThreeD(true)
              }}
            >
              See it in 3D
            </button>
          )}

          <ThreeDDialog
            open={threeD && !threeDFailed}
            onClose={() => {
              setThreeD(false)
              opener.current?.focus()
            }}
            title={option.label}
            total={money(priced.subtotalPromo)}
            tierSwitch={fixedTier ? null : tierButtons}
          >
            <ThreeBoundary
              onError={() => {
                setThreeDFailed(true)
                setThreeD(false)
              }}
            >
              <Suspense fallback={<p className="dims">Loading 3D…</p>}>
                <Wall3D layout={editor.layout} wall={wall} />
              </Suspense>
            </ThreeBoundary>
          </ThreeDDialog>
```

  Import `ThreeDDialog` from `./ThreeDDialog`. Leave the `setThreeD(false)` in "Edit this wall".

- [ ] **Step 5: Let `Wall3D` fill a tall container.** In `Wall3D.tsx` `resize`, change the height line to:

```ts
      const height = el.clientHeight > 0 ? el.clientHeight : Math.round(width * 0.62)
```

- [ ] **Step 6: Style the dialog.** Append to `styles.css`:

```css
/* The 3D pop-up: most of the screen on desktop, all of it on a phone. */
.three-d-dialog { width: 90vw; height: 90vh; max-width: 1600px; padding: 0; border: 0; border-radius: 10px; display: flex; flex-direction: column; }
.three-d-dialog::backdrop { background: rgba(18, 34, 59, 0.55); }
.three-d-head { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--color-rule); flex-wrap: wrap; }
.three-d-head h2 { font-size: 20px; margin: 0; margin-right: auto; }
.three-d-total { font-weight: 700; font-size: 18px; }
.three-d-body { flex: 1; min-height: 0; position: relative; }
.three-d-body .wall3d, .three-d-body .wall3d-canvas { height: 100%; }
@media (max-width: 1023px) {
  .three-d-dialog { width: 100vw; height: 100dvh; max-width: none; max-height: none; border-radius: 0; }
}
```

- [ ] **Step 7: Run everything**

Run: `cd web && npm test -- --run && npx tsc -b && npm run build && npm run check:bundle`
Expected: the 8 ThreeD tests pass; the suite is green; the entry chunk ≤ 58,200 (1D branches from 1C).

- [ ] **Step 8: Commit**

```bash
cd $WT/v1d && git checkout -- web/tsconfig.tsbuildinfo && git add web/src && git commit -m "1D: See it in 3D opens a large pop-up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Scene parts modeled to the renders

**Files:**
- Modify: `web/src/three/buildScene.ts`
- Modify: `web/src/three/__tests__/buildScene.test.ts`

**Interfaces:**
- Produces:
  - `Box` gains `shape?: 'box' | 'rounded' | 'cylinder'` (default `'box'`). For `cylinder`, `w` = `d` = diameter.
  - Legs become two cylinders each (sleeve + foot).
  - Each pull becomes three `pull` boxes: two posts and a grip.
  - Carcass and fronts become `rounded`.

- [ ] **Step 1: Write the failing tests.** Append to `buildScene.test.ts`:

```ts
describe('modeled to the renders', () => {
  const base = { sku: 'MV-B24-F', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' as const }

  it('builds each leg as a sleeve over a slimmer foot', () => {
    const legs = of(one(base), 'leg')
    expect(legs).toHaveLength(8)
    for (const leg of legs) expect(leg.shape).toBe('cylinder')
    const widths = [...new Set(legs.map((l) => l.w))].sort()
    expect(widths).toHaveLength(2)
  })

  it('builds each bar pull as two posts and a grip standing off the door', () => {
    const boxes = one(base)
    const pulls = of(boxes, 'pull')
    expect(pulls).toHaveLength(2 * 3) // a pair of doors
    const faceFront = Math.max(...of(boxes, 'front').map((f) => f.z + f.d))
    const grips = pulls.filter((p) => p.z > faceFront + 0.1)
    expect(grips).toHaveLength(2)
  })

  it('softens the edges of boxes and fronts', () => {
    const boxes = one(base)
    for (const b of [...of(boxes, 'carcass'), ...of(boxes, 'front')]) expect(b.shape).toBe('rounded')
  })
})
```

  Also update the Task 6 assertion `expect(legs).toHaveLength(4)` in "raises a base box onto four legs" to `toHaveLength(8)`, with the comment `// four legs, sleeve and foot each`. In its loop, assert `leg.y >= 0` and `leg.y + leg.h <= 4 + 1e-9`.

Run: `cd web && npx vitest run src/three`
Expected: FAIL — `shape` is undefined, and there are 4 legs and 2 pulls.

- [ ] **Step 2: Implement.** In `buildScene.ts`:
  - add `shape?: 'box' | 'rounded' | 'cylinder'` to `Box`;
  - import `LEG` (already imported) and `PULL` from `../geometry/fronts`;
  - replace the `return [...]` of `itemBoxes` for cabinets with:

```ts
  const lift = item.height - boxHeight(item)
  const { faces, pulls } = fronts(item, item.y + item.height, -1)
  const sleeve = LEG.height * LEG.sleeveShare

  return [
    { material: 'carcass', shape: 'rounded', x: item.x, y: item.y + lift, z: 0, w: item.width, h: boxHeight(item), d: carcassDepth },
    ...faces.map((f): Box => ({ material: 'front', shape: 'rounded', x: f.x, y: f.y - f.height, z: carcassDepth, w: f.width, h: f.height, d: FRONT_THICKNESS })),
    ...pulls.flatMap((p) => barPull(p, item.depth)),
    ...legPositions(item).flatMap((leg): Box[] => [
      // Foot on the floor, sleeve above it.
      { material: 'leg', shape: 'cylinder', x: leg.x - LEG.footDiameter / 2, y: item.y, z: leg.z - LEG.footDiameter / 2, w: LEG.footDiameter, h: LEG.height - sleeve, d: LEG.footDiameter },
      { material: 'leg', shape: 'cylinder', x: leg.x - LEG.sleeveDiameter / 2, y: item.y + LEG.height - sleeve, z: leg.z - LEG.sleeveDiameter / 2, w: LEG.sleeveDiameter, h: sleeve, d: LEG.sleeveDiameter },
    ]),
  ]
```

  Add below `itemBoxes`:

```ts
const POST = 0.4 // square post section, inches
const GRIP_STANDOFF = 1 // how far the grip stands off the door

/** A U-shaped square bar pull (MV-BP36570FB render): two posts into the door and a grip across them. */
function barPull(p: { x: number; y: number; width: number; height: number }, faceZ: number): Box[] {
  const bottom = p.y - p.height
  const vertical = p.height > p.width
  const posts: Box[] = vertical
    ? [
        { material: 'pull', x: p.x, y: p.y - POST, z: faceZ, w: p.width, h: POST, d: GRIP_STANDOFF },
        { material: 'pull', x: p.x, y: bottom, z: faceZ, w: p.width, h: POST, d: GRIP_STANDOFF },
      ]
    : [
        { material: 'pull', x: p.x, y: bottom, z: faceZ, w: POST, h: p.height, d: GRIP_STANDOFF },
        { material: 'pull', x: p.x + p.width - POST, y: bottom, z: faceZ, w: POST, h: p.height, d: GRIP_STANDOFF },
      ]
  const grip: Box = { material: 'pull', x: p.x, y: bottom, z: faceZ + GRIP_STANDOFF, w: p.width, h: p.height, d: POST }
  return [...posts, grip]
}
```

  Remove the now-unused `PULL_PROUD` constant if `tsc` reports it.

- [ ] **Step 3: Run the tests**

Run: `cd web && npx vitest run src/three && npm test -- --run && npx tsc -b`
Expected: green.

The base-cabinet grips now reach z = 25.4″, past the counter front. So in `frameCamera`, raise `CABINET_REACH` from `25` to `26`, with the comment `// the counter front, and the bar pulls on the bases just past it`. Re-run `npx vitest run src/three`; the perspective-fit tests must still pass.

- [ ] **Step 4: Commit:** `"1D: legs, bar pulls and softened edges modeled to the renders"`.

---

### Task 9: `Wall3D` — instancing, materials, light and shadow

**Files:**
- Modify: `web/src/three/Wall3D.tsx`

**Interfaces:**
- Consumes: `Box.shape` (Task 8); `${import.meta.env.BASE_URL}textures/butcher-block.webp` (Task 4).
- Produces: unchanged props. The host's `data-geometries` and `data-textures` stay flat across reopenings.

- [ ] **Step 1: Replace the mesh-building section.** In the effect, replace the unit-cube loop with grouped instancing and per-size rounded geometry:

```ts
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
```

```ts
    // Lighting: image-based ambient from a built-in studio room, plus one soft shadow-casting key.
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(wall.length * 0.35, wall.ceiling * 1.6, 160)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.radius = 6
    const half = Math.max(wall.length, wall.ceiling)
    Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 800 })
    key.target.position.set(wall.length / 2, 0, 0)
    scene.add(key, key.target)

    // Textured laminate: a faint, fixed noise as a bump map, so the gray reads as a surface, not paint.
    const noise = document.createElement('canvas')
    noise.width = noise.height = 128
    const ctx = noise.getContext('2d')!
    let seed = 7
    for (let i = 0; i < 128 * 128; i++) {
      seed = (seed * 16807) % 2147483647
      const v = 120 + (seed % 16)
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(i % 128, Math.floor(i / 128), 1, 1)
    }
    const grain = new THREE.CanvasTexture(noise)
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping
    grain.repeat.set(6, 6)
    materials.carcass.bumpMap = materials.front.bumpMap = grain
    materials.carcass.bumpScale = materials.front.bumpScale = 0.15

    const wood = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/butcher-block.webp`, render)
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping
    wood.colorSpace = THREE.SRGBColorSpace
    materials.counter.map = wood
    materials.counter.color.set(0xffffff)

    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20)
    const rounded = new Map<string, THREE.BufferGeometry>()
    const roundedFor = (b: Box) => {
      const k = `${b.w}|${b.h}|${b.d}`
      if (!rounded.has(k)) rounded.set(k, new RoundedBoxGeometry(b.w, b.h, b.d, 2, Math.min(0.0625, b.w / 4, b.h / 4, b.d / 4)))
      return rounded.get(k)!
    }

    // One InstancedMesh per (shape, material, and for rounded boxes, size); boxes and cylinders scale a unit shape.
    const groups = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; boxes: Box[]; scaled: boolean }>()
    for (const b of buildScene(layout, wall)) {
      const shape = b.shape ?? 'box'
      const geometry = shape === 'rounded' ? roundedFor(b) : shape === 'cylinder' ? unitCylinder : unitBox
      const k = `${shape}|${b.material}|${shape === 'rounded' ? `${b.w}|${b.h}|${b.d}` : ''}`
      if (!groups.has(k)) groups.set(k, { geometry, material: materials[b.material], boxes: [], scaled: shape !== 'rounded' })
      groups.get(k)!.boxes.push(b)
    }
    const matrix = new THREE.Matrix4()
    for (const { geometry, material, boxes, scaled } of groups.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, boxes.length)
      boxes.forEach((b, i) => {
        matrix.compose(
          new THREE.Vector3(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2),
          new THREE.Quaternion(),
          scaled ? new THREE.Vector3(b.w, b.h, b.d) : new THREE.Vector3(1, 1, 1),
        )
        mesh.setMatrixAt(i, matrix)
      })
      mesh.castShadow = material !== materials.ghost && material !== materials.wall && material !== materials.floor
      mesh.receiveShadow = true
      scene.add(mesh)
    }
```

  `Box` is a type import from `./buildScene`. Remove the old `unit` geometry and the `HemisphereLight`/`DirectionalLight` lines this replaces. Keep the camera, controls and resize code.

  Wood repeat: set `wood.repeat.set(4, 1)` so the strips are a believable width on a 74–98″ top. Adjust in the browser check with a ruling if it reads wrong.

- [ ] **Step 2: Extend cleanup.** In the effect's cleanup, before `renderer.dispose()`:

```ts
      unitBox.dispose()
      unitCylinder.dispose()
      rounded.forEach((g) => g.dispose())
      grain.dispose()
      wood.dispose()
      environment.dispose()
      pmrem.dispose()
      scene.traverse((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).dispose())
```

- [ ] **Step 3: Typecheck, test, build, budget**

Run: `cd web && npx tsc -b && npm test -- --run && npm run build && npm run check:bundle`
Expected:
- green;
- the entry chunk is unchanged (≤ 58,200);
- the 3D chunk grows by the two add-ons (record its gz size).

- [ ] **Step 4: Browser check against the renders.** Run the v1d dev server on a spare port. On `?demo=vignette-72`, `?demo=two-car-panel` and a live 360″ Storage wall (needs the API), open the pop-up and screenshot it beside the `MV-B24-F`, `MV-DB30-3`, `MV-PC3084` and `MV-CTHW9825` previews. Check:
  - legs read as stainless two-stage legs;
  - pulls are black U-bars;
  - edges catch light;
  - the gray matches the renders;
  - the counter shows strips;
  - shadows sit under the cabinets;
  - nothing looks plastic.

  Fix with ledger rulings (light intensity, bump scale, wood repeat).

- [ ] **Step 5: Performance and memory.** As in Phase 2 Task 8:
  - a 360″ Storage wall at 4× CPU throttling opens in < 1000 ms (warm chunk);
  - open and close the pop-up across three cards × two tiers: `data-geometries` and `data-textures` identical on every open;
  - no "Too many active WebGL contexts" warning.

- [ ] **Step 6: Commit:** `"1D: instanced, lit and shadowed 3D in the renders' materials"`.

---

### Task 10: Docs, push and hand-off

**Files:**
- Modify: `README.md`, `docs/DECISIONS.md`, `docs/PLAN.md`. Spec and plan changes go on the branch where each change lives.

- [ ] **Step 1: On `v1a`:**
  - **README:** under "Running it locally", add "Product images: `cd web && npm run build:renders` regenerates `web/public/renders` from `assets/reference/sku-renders` (not in git)". Update the web test count.
  - **DECISIONS rows:**
    - legs drawn at 4″ (pending the vendor confirmation in Needs Joshua);
    - the measured constants and where they live;
    - images as static WebP, outside the bundle;
    - any Task 3/4 rulings.

  Commit, and merge `v1a` again into `v1b-reorder`, `v1c-3d` and `v2.0`, keeping both sides of `DECISIONS.md`.

- [ ] **Step 2: On `v1d-3d-quality`:**
  - **DECISIONS rows:**
    - the dialog replaces the in-card 3D;
    - instancing and rounded-geometry approach;
    - lighting choices;
    - the measured 3D chunk size;
    - the Task 9 rulings.
  - **PLAN.md:** a "1D — 3D quality (optional)" entry under Phase 2.
  - **README versions table:** add a `v1d-3d-quality` row with its web test count.

  Commit.

- [ ] **Step 3: Push and open the 1D pull request against `v1c-3d`**

```bash
for b in v1a v1b-reorder v1c-3d v2.0 v1d-3d-quality; do git -C $ROOT -c credential.helper= -c "credential.helper=!$HOME/.local/bin/gh auth git-credential" push -u origin $b; done
$HOME/.local/bin/gh pr create -R jsjogit/rta-garage-configurator --base v1c-3d --head v1d-3d-quality --title "1D: 3D in a pop-up, modeled to the manufacturer's renders (optional)" --body-file <prepared body>
```

The body follows the earlier PR format: what the customer gets, how it's built, tests, browser and performance numbers, deferred minors, and the closing `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line.

Expected: all four PRs green.

- [ ] **Step 4: Remove the worktrees** (`git worktree remove $WT/<name>` for each; `git worktree prune`). Leave the main checkout on whichever branch the planner should serve.
