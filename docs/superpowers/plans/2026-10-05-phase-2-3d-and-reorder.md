# Phase 2 — 3D View and Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cabinet reordering to the 2D editor and a view-only, lazily loaded Three.js 3D view per result card. Both serve the "confidence to buy" goal.

**Architecture:** Everything is web-only. No API, Core or catalog changes.

- **Reorder** is a pure function over `LayoutDto` (`web/src/editor/reorder.ts`). It feeds the editor's existing validate + price round trip.
- **Shared front geometry.** Cabinet fronts move out of `Elevation.tsx` into `web/src/geometry/fronts.ts`, so the SVG and the 3D scene draw from one description.
- **The 3D view has two layers:**
  - `web/src/three/buildScene.ts` is pure and unit-tested. It turns a layout into boxes.
  - `web/src/three/Wall3D.tsx` is the only file that imports Three.js. It is reached through `React.lazy`, so `three` never enters the main bundle.

**Tech Stack:** React 18 + Vite 6 + TypeScript 5.7, Vitest 2 + Testing Library (jsdom), Three.js `0.186.x` (with `@types/three`), Playwright MCP for real-browser checks.

**Spec:** `docs/superpowers/specs/2026-10-05-phase-2-3d-design.md`

## Versions and branches (Joshua, 2026-10-05)

1B and 1C are optional and independent. Either can be dropped without touching the other or 1A.

| Version | Branch | Built from | Tasks |
|---|---|---|---|
| **1A** | `v1a` | today's Phase 1 (this commit) | — |
| **1B** — reorder | `v1b-reorder` | `v1a` | 2, 3, 4 |
| **1C** — 3D view | `v1c-3d` | `v1a` | 1, 5, 6, 7 |
| **2.0** | `v2.0` | `v1a` + merge `v1b-reorder` + merge `v1c-3d` | 8, 9 |

- **1C does not depend on 1B.**
  - Task 7's `onReorder={editing ? onMove : undefined}` line is left out on `v1c-3d`.
  - `v1c-3d` adds only the `'view_3d_opened'` event name.
  - Both are restored when the branches merge into `v2.0`.
- **The bundle check (Task 1) ships with 1C.** Its job is keeping Three.js lazy. `v2.0` runs it over everything.
- **Each branch records its own decisions** in DECISIONS.md and is tested and browser-checked on its own before `v2.0`.

## Global Constraints

- **No backend changes:** no changes to `src/`, `tests/`, `data/` or the API. Every layout change still goes through `POST /api/validate` + `POST /api/price`.
- **`three` stays out of the main bundle:**
  - `three` is added to `web/` only, and is imported only by `web/src/three/Wall3D.tsx`.
  - `Wall3D` is loaded with `React.lazy`.
- **Main bundle budget:** the entry chunk must stay ≤ **58,200 bytes gzipped**. That is the 56.2 KB starting point at `6ef976d` plus 2 KB. CI fails otherwise.
- **3D is view-only:**
  - nothing in 3D edits the layout;
  - no stain toggle, no GLB/USDZ export, no AR;
  - no opening doors, no materials picker, no side walls, no screenshots.
- **Reorder rules:**
  - a move stays in its row (floor = `Base`/`Tall`/`KneeSpace`, wall = `Wall`);
  - a move stays in its unbroken stretch;
  - `Filler` and `Counter` never move;
  - a stretch is re-packed from its left edge;
  - one drop is one edit.
- **Units are inches everywhere,** including the 3D scene (1 Three.js unit = 1 inch).
- **Funnel event names, exactly:**
  - `view_3d_opened` with props `{ rank, tier }`;
  - `layout_reordered` with props `{ rank, row }`.
- **Customer-facing copy, exactly:**
  - toggle: "See it in 3D" / "Back to the drawing";
  - Front view button: "Front view";
  - panel buttons: "Move left" / "Move right";
  - fallback note: "We couldn’t show this wall in 3D on this device."
- **Every task ends with all suites green:** `cd web && npm test -- --run`, `npx tsc -b`, `npm run build`. Then run `git checkout -- web/tsconfig.tsbuildinfo` before committing. That file is a tracked build cache, and the build rewrites it.
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Stacked wall cabinets.** At ceilings ≥ 108″, Storage can stack a 15″ upper on a 30″ upper at the same x. A reorder must move the stack as one unit, never split it. Test in Task 2.
2. **Rapid Move clicks.** Two quick "Move right" presses while the first reprice is in flight must end on the two-step layout, priced by the last response. Test in Task 3.
3. **Tier switch or edit while 3D is open.** The 3D view must re-render the layout the parts table is pricing. Opening "Edit this wall" closes 3D. Test in Task 7.
4. **Shared-design page.** The page shows one option on a fixed tier. The 3D toggle must still work there. Test in Task 7.
5. **Extreme walls framed by the camera.** On a 360″ × 84″ wall and a 72″ × 120″ wall, in both landscape and phone aspect ratios, the whole wall must fit the straight-on Front view. Test in Task 6.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `web/scripts/check-bundle.mjs` | Create | Fails if the entry chunk exceeds 58,200 bytes gzipped or contains Three.js |
| `web/package.json` | Modify | `check:bundle` script; `three`, `@types/three` |
| `.github/workflows/ci.yml` | Modify | Run `npm run check:bundle` after `npm run build` |
| `web/src/editor/reorder.ts` | Create | `rowOf`, `reorder`, `canMove`, `stepsForDrag`: pure reorder rules |
| `web/src/editor/__tests__/reorder.test.ts` | Create | Reorder rule tests |
| `web/src/hooks/useWallEditor.ts` | Modify | `move(index, steps)` |
| `web/src/components/CabinetPanel.tsx` | Modify | Move left / Move right buttons |
| `web/src/components/Elevation.tsx` | Modify | Drag + arrow-key reorder in edit mode; draws `fronts()`; stable item keys |
| `web/src/components/Results.tsx` | Modify | Wires move/drag/keys, the 3D toggle, the error fallback and events |
| `web/src/api/types.ts` | Modify | Two new `FunnelEventName`s |
| `web/src/geometry/fronts.ts` | Create | Cabinet fronts (faces, pulls) as rectangles, shared by 2D and 3D |
| `web/src/geometry/__tests__/fronts.test.ts` | Create | Fronts tests |
| `web/src/three/buildScene.ts` | Create | `buildScene`, `frameCamera`: pure, no Three.js import |
| `web/src/three/__tests__/buildScene.test.ts` | Create | Scene and camera tests |
| `web/src/three/support.ts` | Create | `hasWebGL()` without importing Three.js |
| `web/src/three/ThreeBoundary.tsx` | Create | Error boundary that reports a 3D failure |
| `web/src/three/Wall3D.tsx` | Create | The only Three.js file: renderer, camera, controls, lights, disposal |
| `web/src/components/__tests__/ThreeD.test.tsx` | Create | Toggle, tier sync, fallback and event tests (Wall3D mocked) |
| `web/src/test-setup.ts` | Modify | jsdom `getContext` returns `null` quietly |
| `web/src/styles.css` | Modify | `.wall3d*` and move-button styles |
| `README.md`, `docs/DECISIONS.md`, `docs/PLAN.md` | Modify | Test counts, build-time decisions, session status |

---

## Session 8 — Reorder in the 2D editor

### Task 1: Bundle budget check in CI

This task comes first so that every later task is held to the budget. The spec lists it under Session 10; moving it earlier only changes the order.

**Files:**
- Create: `web/scripts/check-bundle.mjs`
- Modify: `web/package.json` (scripts)
- Modify: `.github/workflows/ci.yml` (web job)

**Interfaces:**
- Produces: `npm run check:bundle`, which exits 1 with a message when the entry chunk is over budget or contains `WebGLRenderer`.

- [ ] **Step 1: Write the script**

```js
// web/scripts/check-bundle.mjs
// Phase 2 budget (docs/superpowers/specs/2026-10-05-phase-2-3d-design.md): the page everyone loads may
// grow by at most 2 KB gzipped, and Three.js must only ever arrive in the lazy 3D chunk.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMIT = 58_200 // bytes gzipped: 56.2 KB at 6ef976d + 2 KB

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const entry = html.match(/src="\/assets\/(index-[^"]+\.js)"/)?.[1]
if (!entry) {
  console.error('check-bundle: could not find the entry script in dist/index.html — run npm run build first.')
  process.exit(1)
}

const code = readFileSync(new URL(`../dist/assets/${entry}`, import.meta.url))
const size = gzipSync(code).length
const problems = []

if (size > LIMIT) problems.push(`entry chunk is ${size} bytes gzipped; the budget is ${LIMIT}.`)
if (code.includes('WebGLRenderer')) problems.push('Three.js leaked into the entry chunk; it must only load lazily.')

if (problems.length > 0) {
  for (const problem of problems) console.error(`check-bundle: ${problem}`)
  process.exit(1)
}

console.log(`check-bundle: entry chunk ${size} bytes gzipped (budget ${LIMIT}).`)
```

- [ ] **Step 2: Add the npm script.** In `web/package.json`, in `"scripts"`, add:

```json
"check:bundle": "node scripts/check-bundle.mjs"
```

- [ ] **Step 3: Run it against today's build**

Run: `cd web && npm run build && npm run check:bundle`
Expected: `check-bundle: entry chunk 56xxx bytes gzipped (budget 58200).` with exit 0.

- [ ] **Step 4: Prove it fails.** Temporarily set `LIMIT = 1000`, run `npm run check:bundle`, and confirm it exits 1 with "entry chunk is … the budget is 1000". Restore `58_200`.

- [ ] **Step 5: Add it to CI.** In `.github/workflows/ci.yml`, web job, directly after `- run: npm run build`, add:

```yaml
      # Phase 2 budget: the page everyone loads grows by at most 2 KB; Three.js stays lazy.
      - run: npm run check:bundle
```

- [ ] **Step 6: Commit**

```bash
git checkout -- web/tsconfig.tsbuildinfo
git add web/scripts/check-bundle.mjs web/package.json .github/workflows/ci.yml
git commit -m "Bundle budget check: entry chunk <= 58,200 bytes gzipped, no Three.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pure reorder rules

**Files:**
- Create: `web/src/editor/reorder.ts`
- Test: `web/src/editor/__tests__/reorder.test.ts`

**Interfaces:**
- Consumes: `LayoutDto`, `PlacedItemDto` from `web/src/api/types.ts`.
- Produces:
  - `type Row = 'floor' | 'wall'`
  - `rowOf(item: PlacedItemDto): Row | null`
  - `reorder(layout: LayoutDto, index: number, steps: number): LayoutDto`. Returns **the same object** when nothing moves. Item order in `items` never changes; only `x` changes.
  - `canMove(layout: LayoutDto, index: number, direction: -1 | 1): boolean`
  - `stepsForDrag(layout: LayoutDto, index: number, dx: number): number`. `dx` is in inches; the result is signed.

**Fixture facts used by the tests** (from `web/src/fixtures/*.json`, `options[0].standard.layout.items`):

`vignette-72`, indices 0–6:

| Index | SKU | x | Zone |
|---|---|---|---|
| 0 | MV-B24-F | 0 | Base |
| 1 | (blank) | 24 | KneeSpace |
| 2 | MV-B24-F | 48 | Base |
| 3 | MV-CTHW7425 | 0 | Counter |
| 4 | MV-W2430 | 0 | Wall |
| 5 | MV-W2415 | 24 | Wall |
| 6 | MV-W2430 | 48 | Wall |

`two-car-panel` (find indices with `findIndex`):

| Row | Stretch | Contents |
|---|---|---|
| Floor | 1 (x 0–171) | B24-F 0, B24-F 24, Knee 48, B24-F 72, PC3084 96 (30 wide), B15 126, B15 141, B15 156 |
| Floor | — | Fillers at 203 and 236 |
| Floor | 2 (x 206–236) | B15 206, B15 221 |
| Wall | 1 (x 0–96) | W2430 0, W2430 24, W2415 48, W2430 72 |
| Wall | 2 (x 126–171) | W1530 126, 141, 156 |
| Wall | 3 (x 206–236) | W1530 206, 221 |

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd web && npx vitest run src/editor/__tests__/reorder.test.ts`
Expected: FAIL — "Failed to resolve import ../reorder".

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run to confirm they pass**

Run: `cd web && npx vitest run src/editor/__tests__/reorder.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Full web suite, typecheck, commit**

```bash
cd web && npm test -- --run && npx tsc -b && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add web/src/editor
git commit -m "Reorder rules: row and stretch bound, re-packed, stacks move together

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Move left / Move right in the editor

**Files:**
- Modify: `web/src/hooks/useWallEditor.ts` (add `move`)
- Modify: `web/src/components/CabinetPanel.tsx` (buttons)
- Modify: `web/src/components/Results.tsx` (`Sheet`: wire `onMove`, track)
- Modify: `web/src/api/types.ts` (`FunnelEventName`)
- Modify: `web/src/styles.css`
- Test: `web/src/components/__tests__/Editor.test.tsx` (append)

**Interfaces:**
- Consumes: `reorder`, `canMove`, `rowOf` from Task 2.
- Produces:
  - `WallEditor.move(index: number, steps: number): void`
  - A `Sheet`-local `onMove(index, steps)` that Task 4 reuses for drag and keys.
  - `CabinetPanel` props `onMove: (index: number, steps: number) => void`, `canMoveLeft: boolean`, `canMoveRight: boolean`.

- [ ] **Step 1: Write the failing tests.** Append to `web/src/components/__tests__/Editor.test.tsx`. That file already defines `stubFetch`, `calls`, `firstSheet`, `startEditing`, `selectFirstCabinet` and `total`, and imports `Results`, `vignette`, `money`, `waitFor` and `within`.

```tsx
describe('moving a cabinet', () => {
  const checks = () => calls.filter((c) => c.url === '/api/validate')
  const prices = () => calls.filter((c) => c.url === '/api/price')
  type Sent = { layout: { items: { x: number }[] } }

  it('moves one place right, and the API checks and prices it once', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = await selectFirstCabinet(user)

    await user.click(within(sheet).getByRole('button', { name: 'Move right' }))

    await waitFor(() => expect(prices()).toHaveLength(1))
    expect(checks()).toHaveLength(1)
    const sent = (prices()[0].body as Sent).layout.items
    expect(sent[0].x).toBe(24)
    expect(sent[1].x).toBe(0)
  })

  it('offers no move left at the start of a run', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = await selectFirstCabinet(user)

    expect(within(sheet).getByRole('button', { name: 'Move left' })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: 'Move right' })).toBeEnabled()
  })

  it('two quick moves end on the two-step wall, priced by the last answer', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = await selectFirstCabinet(user)

    await user.click(within(sheet).getByRole('button', { name: 'Move right' }))
    await user.click(within(sheet).getByRole('button', { name: 'Move right' }))

    await waitFor(() => expect(prices()).toHaveLength(2))
    expect((prices()[1].body as Sent).layout.items[0].x).toBe(48)
    expect(total(sheet)).toBe(money(1234))
  })

  it('undo puts the cabinets back', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = await selectFirstCabinet(user)
    const original = total(sheet)
    const firstCabinetX = () =>
      within(sheet).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0].querySelector('rect')!.getAttribute('x')
    const startX = firstCabinetX()

    await user.click(within(sheet).getByRole('button', { name: 'Move right' }))
    expect(firstCabinetX()).not.toBe(startX)
    await user.click(await within(sheet).findByRole('button', { name: /undo my changes/i }))

    expect(total(sheet)).toBe(original)
    expect(firstCabinetX()).toBe(startX)
  })

  it('a move the rules reject says why and blocks the cart', async () => {
    stubFetch({
      violations: [
        { code: 'KneeSpaceAtRunEnd', message: 'A knee space needs a base cabinet on both sides — it cannot start or end a run.', sku: null },
      ],
    })
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = await selectFirstCabinet(user)

    await user.click(within(sheet).getByRole('button', { name: 'Move right' }))

    expect(await within(sheet).findByText(/knee space needs a base cabinet/i)).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /fix the wall first/i })).toBeDisabled()
  })

  it('records the move in the funnel', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = await selectFirstCabinet(user)

    await user.click(within(sheet).getByRole('button', { name: 'Move right' }))

    const event = calls.find((c) => c.url === '/api/events' && (c.body as { name: string }).name === 'layout_reordered')
    expect(event?.body).toMatchObject({ properties: { rank: '0', row: 'floor' } })
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd web && npx vitest run src/components/__tests__/Editor.test.tsx`
Expected: the six new tests FAIL with "Unable to find an accessible element with the role "button" and name "Move right"".

- [ ] **Step 3: Add the event names.** In `web/src/api/types.ts`, extend `FunnelEventName`:

```ts
  | 'lead_captured'
  | 'view_3d_opened'
  | 'layout_reordered'
```

- [ ] **Step 4: Add `move` to the editor hook.** In `web/src/hooks/useWallEditor.ts`:
  - add `move: (index: number, steps: number) => void` to `interface WallEditor`;
  - import `reorder`;
  - add the callback after `remove`;
  - include it in the return.

```ts
import { reorder } from '../editor/reorder'
```

```ts
  // Tracking lives with the caller, which knows the sheet's rank.
  const move = useCallback((index: number, steps: number) => {
    setLayout((current) => reorder(current, index, steps))
  }, [])

  return { layout, priced, violations, checking, edited, swap, remove, move, reset }
```

`reorder` returns the same object when nothing moves. `setLayout` then bails out, so a no-op move sends no request.

- [ ] **Step 5: Add the buttons to `CabinetPanel`.** Add the three props to the props type and destructuring. Insert this block directly above the existing `<div className="row">` that holds Remove/Done:

```tsx
      <div className="row move-row" role="group" aria-label="Move this cabinet">
        <button type="button" className="btn ghost" disabled={!canMoveLeft} onClick={() => onMove(index, -1)}>
          Move left
        </button>
        <button type="button" className="btn ghost" disabled={!canMoveRight} onClick={() => onMove(index, 1)}>
          Move right
        </button>
      </div>
```

Props additions:

```tsx
  onMove: (index: number, steps: number) => void
  canMoveLeft: boolean
  canMoveRight: boolean
```

- [ ] **Step 6: Wire it in `Sheet`** (`web/src/components/Results.tsx`). Import `canMove`, `reorder` and `rowOf` from `'../editor/reorder'`. Add inside `Sheet`, after `const blocked = ...`:

```tsx
  const onMove = (index: number, steps: number) => {
    const item = editor.layout.items[index]
    if (!item || reorder(editor.layout, index, steps) === editor.layout) return
    editor.move(index, steps)
    onTouch()
    track('layout_reordered', configId, { rank: String(rank), row: rowOf(item) ?? '' })
  }
```

Pass to `CabinetPanel`:

```tsx
          onMove={onMove}
          canMoveLeft={canMove(editor.layout, selected, -1)}
          canMoveRight={canMove(editor.layout, selected, 1)}
```

- [ ] **Step 7: Style.** Append to `web/src/styles.css` after the `.editor { … }` rule:

```css
.move-row .btn:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 8: Run the editor tests**

Run: `cd web && npx vitest run src/components/__tests__/Editor.test.tsx`
Expected: PASS, including the six new tests.

- [ ] **Step 9: Full suite, typecheck, build, budget, commit**

```bash
cd web && npm test -- --run && npx tsc -b && npm run build && npm run check:bundle && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add web/src
git commit -m "Move left / Move right in the cabinet panel, one API check per move

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Drag and arrow keys in the elevation

**Files:**
- Modify: `web/src/components/Elevation.tsx` (`ElevationProps`, `Elevation`, `Item`)
- Modify: `web/src/components/Results.tsx` (pass `onReorder` while editing)
- Modify: `web/src/styles.css`
- Test: `web/src/components/__tests__/Elevation.test.tsx` (append)

**Interfaces:**
- Consumes: `stepsForDrag` (Task 2); `Sheet`'s `onMove` (Task 3).
- Produces: `ElevationProps.onReorder?: (index: number, steps: number) => void`. It is only honoured when `onSelect` is also set, which is edit mode.

- [ ] **Step 1: Write the failing tests.** Append to `web/src/components/__tests__/Elevation.test.tsx`. It already imports `fireEvent`, `render`, `vi` and the `vignette` fixture.

```tsx
describe('reordering in edit mode', () => {
  const layout = (vignette as SolveResponse).options[0].standard.layout

  function editable() {
    const onReorder = vi.fn()
    const onSelect = vi.fn()
    const utils = render(
      <Elevation layout={layout} wallLength={72} ceiling={96} id="r" onSelect={onSelect} onReorder={onReorder} />,
    )
    const svg = utils.container.querySelector('svg')!
    // viewBox is "-10 -14 92 140"; pretend it is drawn at 2px per inch.
    const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: width * 2, height: height * 2, right: width * 2, bottom: height * 2, x: 0, y: 0, toJSON: () => ({}) })
    const first = utils.getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0]
    return { ...utils, onReorder, onSelect, first }
  }

  it('drops a cabinet one place along once it passes its neighbour’s middle', () => {
    const { first, onReorder } = editable()

    fireEvent.pointerDown(first, { clientX: 44, pointerId: 1 }) // x = 12, the cabinet's centre
    fireEvent.pointerMove(first, { clientX: 104, pointerId: 1 }) // +30 inches
    fireEvent.pointerUp(first, { clientX: 104, pointerId: 1 })

    expect(onReorder).toHaveBeenCalledWith(0, 1)
  })

  it('ignores a wiggle, so a tap still selects', () => {
    const { first, onReorder, onSelect } = editable()

    fireEvent.pointerDown(first, { clientX: 44, pointerId: 1 })
    fireEvent.pointerMove(first, { clientX: 46, pointerId: 1 })
    fireEvent.pointerUp(first, { clientX: 46, pointerId: 1 })
    fireEvent.click(first)

    expect(onReorder).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('does not treat the end of a drag as a tap', () => {
    const { first, onSelect } = editable()

    fireEvent.pointerDown(first, { clientX: 44, pointerId: 1 })
    fireEvent.pointerMove(first, { clientX: 104, pointerId: 1 })
    fireEvent.pointerUp(first, { clientX: 104, pointerId: 1 })
    fireEvent.click(first)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('moves the focused cabinet with the arrow keys', () => {
    const { first, onReorder } = editable()

    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(onReorder).toHaveBeenLastCalledWith(0, 1)

    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(onReorder).toHaveBeenLastCalledWith(0, -1)
  })

  it('keeps an item’s element when it moves, so keyboard focus stays on it', () => {
    const { container, rerender } = render(
      <Elevation layout={layout} wallLength={72} ceiling={96} id="k" onSelect={vi.fn()} onReorder={vi.fn()} />,
    )
    const before = container.querySelectorAll('[role=button]')[1]
    const moved = { ...layout, items: layout.items.map((i, n) => (n === 0 ? { ...i, x: 24 } : n === 1 ? { ...i, x: 0 } : i)) }
    rerender(<Elevation layout={moved} wallLength={72} ceiling={96} id="k" onSelect={vi.fn()} onReorder={vi.fn()} />)

    expect(container.querySelectorAll('[role=button]')[1]).toBe(before)
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd web && npx vitest run src/components/__tests__/Elevation.test.tsx`
Expected: the five new tests FAIL. TypeScript-wise `onReorder` is an unknown prop, and at runtime `onReorder` is never called. The focus test fails because the key includes `x`.

- [ ] **Step 3: Implement in `Elevation.tsx`**
  - Add `useState` to the `react` import: `import { useRef, useState } from 'react'`.
  - Import `stepsForDrag` from `'../editor/reorder'`.
  - Add to `ElevationProps`:

```ts
  /** Edit mode only: a cabinet was dragged or arrowed `steps` places along its row. */
  onReorder?: (index: number, steps: number) => void
```

  - Destructure `onReorder` in `Elevation`. Change the item loop's key to `` key={`item-${index}`} `` and pass the drag props:

```tsx
      {ordered.map(({ item, index }) => (
        <Item
          key={`item-${index}`}
          item={item}
          toY={toY}
          id={id}
          index={index}
          selected={selected === index}
          onSelect={onSelect}
          onReorder={onReorder}
          stepsFor={(dx) => stepsForDrag(layout, index, dx)}
        />
      ))}
```

  - Replace the `Item` function with:

```tsx
const DRAG_THRESHOLD = 2 // inches; less than this is a tap

function Item({
  item,
  toY,
  id,
  index,
  selected,
  onSelect,
  onReorder,
  stepsFor,
}: {
  item: PlacedItemDto
  toY: (up: number) => number
  id: string
  index: number
  selected: boolean
  onSelect?: (index: number | null) => void
  onReorder?: (index: number, steps: number) => void
  stepsFor: (dx: number) => number
}) {
  const [dx, setDx] = useState(0)
  const grab = useRef<{ start: number; dragged: boolean } | null>(null)
  const swallowClick = useRef(false)
  const y = toY(item.y + item.height)
  const body = <ItemBody item={item} toY={toY} id={id} />

  if (!onSelect) return body

  const svgOf = (target: EventTarget) => (target as SVGGElement).ownerSVGElement!

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${item.zone === 'KneeSpace' ? 'Open knee space' : item.sku}, ${item.width} inches wide`}
      aria-pressed={selected}
      className={onReorder ? 'elev-hit elev-movable' : 'elev-hit'}
      transform={dx ? `translate(${dx} 0)` : undefined}
      onPointerDown={(event) => {
        if (!onReorder) return
        grab.current = { start: wallX(svgOf(event.currentTarget), event.clientX), dragged: false }
        ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!grab.current) return
        const moved = wallX(svgOf(event.currentTarget), event.clientX) - grab.current.start
        if (Math.abs(moved) >= DRAG_THRESHOLD) grab.current.dragged = true
        if (grab.current.dragged) setDx(moved)
      }}
      onPointerUp={(event) => {
        const drag = grab.current
        grab.current = null
        setDx(0)
        if (!drag?.dragged || !onReorder) return
        swallowClick.current = true
        const steps = stepsFor(wallX(svgOf(event.currentTarget), event.clientX) - drag.start)
        if (steps !== 0) onReorder(index, steps)
      }}
      onPointerCancel={() => {
        grab.current = null
        setDx(0)
      }}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false
          return
        }
        onSelect(selected ? null : index)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(selected ? null : index)
        } else if (onReorder && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
          event.preventDefault()
          onReorder(index, event.key === 'ArrowRight' ? 1 : -1)
        }
      }}
    >
      {body}
      <rect
        x={item.x}
        y={y}
        width={item.width}
        height={item.height}
        fill="transparent"
        stroke={selected ? 'var(--ink)' : 'transparent'}
        strokeWidth={selected ? 1.6 : 0}
      />
    </g>
  )
}
```

`wallX` already exists in this file. It was added for dragging obstructions.

- [ ] **Step 4: Wire it in `Sheet`.** In `Results.tsx`, on the `<Elevation …>` inside `Sheet`, add:

```tsx
            onReorder={editing ? onMove : undefined}
```

- [ ] **Step 5: Style.** Append to `web/src/styles.css` next to the `.elev-hit` rules:

```css
.elev-movable { cursor: grab; touch-action: pan-y; }
.elev-movable:active { cursor: grabbing; }
```

`pan-y` keeps vertical page scrolling on phones while a horizontal drag reorders.

- [ ] **Step 6: Run the tests**

Run: `cd web && npm test -- --run`
Expected: PASS. All existing Elevation snapshots are unchanged; keys do not appear in snapshots.

- [ ] **Step 7: Real-browser check.** Start the stack (README "Running it locally": Azurite, `func start --script-root src/GarageConfigurator.Api`, `cd web && npm run dev`). Then:
  1. Open `http://localhost:5173/` at 1366 × 900.
  2. Type 240, pick Workbench, and click "Edit this wall" on card 1.
  3. Drag a base cabinet one place right. Confirm:
     - the drawing re-packs;
     - one validate + price pair is sent (Playwright `browser_network_requests` with filter `/api/(validate|price)`);
     - the total updates.
  4. Focus a cabinet with Tab and press ArrowLeft. Confirm it moves and keeps focus.

- [ ] **Step 8: Commit**

```bash
cd web && npx tsc -b && npm run build && npm run check:bundle && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add web/src
git commit -m "Drag and arrow keys reorder cabinets in the 2D editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Session 9 — 3D view

### Task 5: Extract cabinet fronts to a shared module

**Files:**
- Create: `web/src/geometry/fronts.ts`
- Modify: `web/src/components/Elevation.tsx` (remove `Fronts` internals, `drawerCount`, `REVEAL`, `PULL`)
- Test: `web/src/geometry/__tests__/fronts.test.ts`

**Interfaces:**
- Consumes: `PlacedItemDto`.
- Produces:
  - `REVEAL = 0.75`
  - `PULL = { length: 0.45, thickness: 1.1 }`
  - `interface Rect { x: number; y: number; width: number; height: number }`
  - `fronts(item: PlacedItemDto, top: number, down: 1 | -1 = 1): { faces: Rect[]; pulls: Rect[] }`. `faces[i]` and `pulls[i]` pair up one-to-one. `y` is each rect's edge nearest `top`. For `down = 1` (SVG) that is the upper edge in page coordinates; for `down = -1` (3D, y up from the floor) it is the upper edge in floor coordinates.
  - `drawerCount(sku: string): number`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd web && npx vitest run src/geometry`
Expected: FAIL — "Failed to resolve import ../fronts".

- [ ] **Step 3: Create `fronts.ts`.** The arithmetic deliberately keeps the old SVG expression order (`top + down * REVEAL + down * i * (…)`). Multiplying by `down = 1` is exact, so the SVG numbers come out bit-for-bit identical and the snapshots cannot change.

```ts
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
```

- [ ] **Step 4: Make `Elevation` draw from it.**
  - Delete `drawerCount`, `const REVEAL` and `const PULL` from `Elevation.tsx`.
  - Add `import { fronts } from '../geometry/fronts'`.
  - Replace the whole `Fronts` component with:

```tsx
/** Slab fronts with matte black bar pulls, from the shared description in geometry/fronts.ts. */
function Fronts({ item, top }: { item: PlacedItemDto; top: number }) {
  const { faces, pulls } = fronts(item, top)

  return (
    <>
      {faces.map((face, i) => (
        <g key={i}>
          <rect x={face.x} y={face.y} width={face.width} height={face.height} fill="var(--slab)" stroke="var(--slab-edge)" strokeWidth="0.3" />
          <rect x={pulls[i].x} y={pulls[i].y} width={pulls[i].width} height={pulls[i].height} fill="var(--ink)" />
        </g>
      ))}
    </>
  )
}
```

If `tsc` reports `REVEAL` or `PULL` still used elsewhere in `Elevation.tsx`, import them from `../geometry/fronts` rather than redefining them.

- [ ] **Step 5: Run everything. The snapshots must not change.**

Run: `cd web && npm test -- --run`
Expected: PASS with **0 snapshots updated or written**. If any Elevation snapshot fails, do **not** run `-u`. A failing snapshot means the extraction changed the arithmetic; fix `fronts.ts` until the old numbers come back.

- [ ] **Step 6: Commit**

```bash
cd web && npx tsc -b && npm run build && npm run check:bundle && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add web/src
git commit -m "Cabinet fronts live in geometry/fronts.ts; the SVG draws from it unchanged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pure 3D scene description and camera framing

**Files:**
- Create: `web/src/three/buildScene.ts`
- Test: `web/src/three/__tests__/buildScene.test.ts`

**Interfaces:**
- Consumes: `fronts` (Task 5), `LayoutDto`, `ObstructionDto`, `PlacedItemDto`, `WallDto`.
- Produces:
  - `type MaterialKey = 'carcass' | 'front' | 'pull' | 'counter' | 'wall' | 'floor' | 'ghost'`
  - `interface Box { material: MaterialKey; x: number; y: number; z: number; w: number; h: number; d: number }`. `(x, y, z)` is the min corner, in inches. x runs along the wall from the left corner, y up from the floor, z out from the wall face.
  - `buildScene(layout: LayoutDto, wall: WallDto): Box[]`
  - `interface CameraFrame { position: [number, number, number]; target: [number, number, number]; distance: number }`
  - `frameCamera(wall: WallDto, fovDeg: number, aspect: number, angle?: { azimuthDeg?: number; elevationDeg?: number }): CameraFrame`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/three/__tests__/buildScene.test.ts
import { describe, expect, it } from 'vitest'
import { buildScene, frameCamera, type Box } from '../buildScene'
import type { LayoutDto, PlacedItemDto, SolveResponse, WallDto } from '../../api/types'
import vignetteJson from '../../fixtures/vignette-72.json'
import panelJson from '../../fixtures/two-car-panel.json'

const vignette = (vignetteJson as SolveResponse).options[0]
const panel = (panelJson as SolveResponse).options[0].standard.layout
const wall72: WallDto = { length: 72, ceiling: 96 }

const of = (boxes: Box[], material: Box['material']) => boxes.filter((b) => b.material === material)
const one = (item: PlacedItemDto) => buildScene({ items: [item] }, { length: 120, ceiling: 96 })

describe('buildScene', () => {
  it('draws a box for every cabinet and leaves the knee space open', () => {
    const boxes = buildScene(vignette.standard.layout, wall72)
    expect(of(boxes, 'carcass')).toHaveLength(5) // two bases, three uppers; nothing for the knee space
    expect(of(boxes, 'counter')).toHaveLength(1)
  })

  it('gives a 3-drawer base three fronts and three pulls', () => {
    const boxes = one({ sku: 'MV-DB24-3', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' })
    expect(of(boxes, 'front')).toHaveLength(3)
    expect(of(boxes, 'pull')).toHaveLength(3)
  })

  it('stands every pull proud of its own cabinet’s fronts', () => {
    for (const item of [
      { sku: 'MV-DB24-3', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' as const },
      { sku: 'MV-W2430', x: 0, y: 54, width: 24, height: 30, depth: 12, zone: 'Wall' as const },
    ]) {
      const boxes = one(item)
      const frontFace = Math.max(...of(boxes, 'front').map((b) => b.z + b.d))
      expect(frontFace).toBeCloseTo(item.depth, 9)
      for (const pull of of(boxes, 'pull')) expect(pull.z).toBeGreaterThanOrEqual(frontFace - 1e-9)
    }
  })

  it('draws premiere differently from standard', () => {
    const fronts = (layout: LayoutDto) => of(buildScene(layout, wall72), 'front').length
    expect(fronts(vignette.premiere.layout)).not.toBe(fronts(vignette.standard.layout))
  })

  it('ghosts every obstruction', () => {
    const wall: WallDto = {
      length: 240,
      ceiling: 96,
      obstructions: [
        { type: 'ElectricalPanel', startX: 171, width: 16, height: 30, bottomY: 48 },
        { type: 'WaterHeater', startX: 0, width: 30, height: 72, bottomY: 0 },
      ],
    }
    expect(of(buildScene(panel, wall), 'ghost')).toHaveLength(2)
  })

  it('keeps every cabinet part on the floor, inside the wall and under the ceiling', () => {
    const wall: WallDto = { length: 240, ceiling: 96 }
    for (const b of buildScene(panel, wall).filter((b) => !['wall', 'floor', 'ghost'].includes(b.material))) {
      expect(b.x).toBeGreaterThanOrEqual(-1e-9)
      expect(b.x + b.w).toBeLessThanOrEqual(wall.length + 1e-9)
      expect(b.y).toBeGreaterThanOrEqual(-1e-9)
      expect(b.y + b.h).toBeLessThanOrEqual(wall.ceiling + 1e-9)
      expect(b.z).toBeGreaterThanOrEqual(-1e-9)
    }
  })

  it('draws the wall behind and the floor below everything', () => {
    const boxes = buildScene(panel, { length: 240, ceiling: 96 })
    expect(of(boxes, 'wall')[0].z + of(boxes, 'wall')[0].d).toBeLessThanOrEqual(0)
    expect(of(boxes, 'floor')[0].y + of(boxes, 'floor')[0].h).toBeLessThanOrEqual(0)
  })
})

describe('frameCamera', () => {
  /** Does the wall's every corner land inside the picture for a straight-on camera? */
  function fits(wall: WallDto, fov: number, aspect: number) {
    const frame = frameCamera(wall, fov, aspect)
    const halfV = Math.tan((fov * Math.PI) / 360)
    const halfH = halfV * aspect
    for (const [x, y] of [[0, 0], [wall.length, 0], [0, wall.ceiling], [wall.length, wall.ceiling]]) {
      const depth = frame.position[2] - 0 // the wall face is at z = 0
      expect(Math.abs(x - frame.position[0]) / (depth * halfH)).toBeLessThanOrEqual(1)
      expect(Math.abs(y - frame.position[1]) / (depth * halfV)).toBeLessThanOrEqual(1)
    }
  }

  it('fits a long, low wall and a short, tall wall, on a laptop and a phone', () => {
    for (const wall of [{ length: 360, ceiling: 84 }, { length: 72, ceiling: 120 }]) {
      for (const aspect of [16 / 9, 390 / 242]) fits(wall, 35, aspect)
    }
  })

  it('keeps the same distance when it swings round to an angle', () => {
    const straight = frameCamera(wall72, 35, 1.6)
    const angled = frameCamera(wall72, 35, 1.6, { azimuthDeg: -25, elevationDeg: 12 })
    const dist = (f: typeof straight) => Math.hypot(...f.position.map((p, i) => p - f.target[i]))
    expect(dist(angled)).toBeCloseTo(dist(straight), 6)
    expect(angled.position[0]).toBeLessThan(straight.position[0])
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd web && npx vitest run src/three`
Expected: FAIL — "Failed to resolve import ../buildScene".

- [ ] **Step 3: Implement**

```ts
// web/src/three/buildScene.ts
import type { LayoutDto, ObstructionDto, PlacedItemDto, WallDto } from '../api/types'
import { fronts } from '../geometry/fronts'

/*
  The 3D wall as plain boxes, with no Three.js in sight, so it can be tested without a GPU. Inches
  throughout: x along the wall from the left corner, y up from the floor, z out from the wall face.
  Wall3D.tsx is the only file that turns these into meshes.
*/

export type MaterialKey = 'carcass' | 'front' | 'pull' | 'counter' | 'wall' | 'floor' | 'ghost'

/** An axis-aligned box. (x, y, z) is its min corner. */
export interface Box {
  material: MaterialKey
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

const FRONT_THICKNESS = 0.75
const PULL_PROUD = 1 // how far a bar pull stands off its front
const ROOM_MARGIN = 24 // wall and floor run a little past the cabinets either side
const FLOOR_DEPTH = 60
const GHOST_DEPTH: Record<string, number> = { WaterHeater: 22 }

export function buildScene(layout: LayoutDto, wall: WallDto): Box[] {
  const span = wall.length + ROOM_MARGIN * 2
  const boxes: Box[] = [
    { material: 'wall', x: -ROOM_MARGIN, y: 0, z: -1, w: span, h: wall.ceiling, d: 1 },
    { material: 'floor', x: -ROOM_MARGIN, y: -1, z: -1, w: span, h: 1, d: FLOOR_DEPTH },
  ]

  for (const obstruction of wall.obstructions ?? []) boxes.push(ghost(obstruction))
  for (const item of layout.items) boxes.push(...itemBoxes(item))
  return boxes
}

function ghost(o: ObstructionDto): Box {
  return { material: 'ghost', x: o.startX, y: o.bottomY, z: 0, w: o.width, h: o.height, d: GHOST_DEPTH[o.type] ?? 1 }
}

function itemBoxes(item: PlacedItemDto): Box[] {
  if (item.zone === 'KneeSpace') return []

  const whole = { x: item.x, y: item.y, z: 0, w: item.width, h: item.height, d: item.depth }
  if (item.zone === 'Counter') return [{ material: 'counter', ...whole }]
  if (item.zone === 'Filler') return [{ material: 'carcass', ...whole }]

  // The carcass stops short of the front so the slab faces sit flush with the cabinet's full depth.
  const carcassDepth = item.depth - FRONT_THICKNESS
  const { faces, pulls } = fronts(item, item.y + item.height, -1)

  return [
    { material: 'carcass', ...whole, d: carcassDepth },
    ...faces.map((f): Box => ({ material: 'front', x: f.x, y: f.y - f.height, z: carcassDepth, w: f.width, h: f.height, d: FRONT_THICKNESS })),
    ...pulls.map((p): Box => ({ material: 'pull', x: p.x, y: p.y - p.height, z: item.depth, w: p.width, h: p.height, d: PULL_PROUD })),
  ]
}

export interface CameraFrame {
  position: [number, number, number]
  target: [number, number, number]
  distance: number
}

const FRAME_MARGIN = 1.12

/**
 * Where to put a camera with this vertical field of view and aspect ratio so the whole wall, floor
 * to ceiling and corner to corner, fits — then optionally swing it round the wall's centre.
 */
export function frameCamera(
  wall: WallDto,
  fovDeg: number,
  aspect: number,
  angle: { azimuthDeg?: number; elevationDeg?: number } = {},
): CameraFrame {
  const halfV = Math.tan((fovDeg * Math.PI) / 360)
  const halfH = halfV * aspect
  const distance = Math.max(wall.ceiling / 2 / halfV, wall.length / 2 / halfH) * FRAME_MARGIN

  const target: [number, number, number] = [wall.length / 2, wall.ceiling / 2, 0]
  const az = ((angle.azimuthDeg ?? 0) * Math.PI) / 180
  const el = ((angle.elevationDeg ?? 0) * Math.PI) / 180

  return {
    target,
    distance,
    position: [
      target[0] + distance * Math.cos(el) * Math.sin(az),
      target[1] + distance * Math.sin(el),
      target[2] + distance * Math.cos(el) * Math.cos(az),
    ],
  }
}
```

- [ ] **Step 4: Run to confirm they pass**

Run: `cd web && npx vitest run src/three`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
cd web && npm test -- --run && npx tsc -b && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add web/src/three
git commit -m "3D scene as plain boxes, and camera framing that fits any wall

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The 3D view in the card

**Files:**
- Modify: `web/package.json` (`three`, `@types/three`)
- Create: `web/src/three/support.ts`
- Create: `web/src/three/ThreeBoundary.tsx`
- Create: `web/src/three/Wall3D.tsx`
- Modify: `web/src/components/Results.tsx` (`Sheet`)
- Modify: `web/src/test-setup.ts`
- Modify: `web/src/styles.css`
- Test: `web/src/components/__tests__/ThreeD.test.tsx`

**Interfaces:**
- Consumes: `buildScene`, `frameCamera`, `MaterialKey` (Task 6); `FunnelEventName` `'view_3d_opened'` (Task 3).
- Produces:
  - `hasWebGL(): boolean`
  - `class ThreeBoundary` with props `{ onError: () => void; children: ReactNode }`
  - `default export function Wall3D(props: { layout: LayoutDto; wall: WallDto })`. Its host element exposes `data-geometries` and `data-textures` for the memory check in Task 9.

- [ ] **Step 1: Install Three.js**

Run: `cd web && npm install three@^0.186.1 && npm install -D @types/three`
Expected: `package.json` lists `"three"` under dependencies and `"@types/three"` under devDependencies.

- [ ] **Step 2: Keep jsdom quiet about canvases.** Append to `web/src/test-setup.ts`:

```ts
// jsdom has no canvas backend and logs "Not implemented" for getContext. Answer like a browser
// without WebGL would.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
```

- [ ] **Step 3: Write the failing tests**

```tsx
// web/src/components/__tests__/ThreeD.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Results } from '../Results'
import type { LayoutDto, SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'

const state = vi.hoisted(() => ({ webgl: true, explode: false }))

vi.mock('../../three/support', () => ({ hasWebGL: () => state.webgl }))
vi.mock('../../three/Wall3D', () => ({
  default: ({ layout }: { layout: LayoutDto }) => {
    if (state.explode) throw new Error('WebGL context lost')
    return <div data-testid="wall3d" data-skus={layout.items.map((i) => i.sku).join(',')} />
  },
}))

const solved = vignette as SolveResponse
const wall = { length: 72, ceiling: 96 }
let events: { name: string; properties: Record<string, string> | null }[] = []

beforeEach(() => {
  state.webgl = true
  state.explode = false
  events = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/events') events.push(JSON.parse(init!.body as string))
      return { ok: true, status: 200, json: async () => ({}) } as Response
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const firstSheet = () => screen.getAllByRole('article')[0]
const show = (response: SolveResponse = solved) =>
  render(<Results response={response} wall={wall} onStartOver={vi.fn()} />)

describe('See it in 3D', () => {
  it('swaps the drawing for the 3D view inside the same card', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(firstSheet()).findByTestId('wall3d')).toBeInTheDocument()
    expect(within(firstSheet()).queryByRole('img', { name: /front elevation/i })).not.toBeInTheDocument()
    expect(within(firstSheet()).getByRole('button', { name: 'Back to the drawing' })).toBeInTheDocument()
  })

  it('follows the tier switch while open', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(firstSheet()).findByTestId('wall3d')

    await user.click(within(firstSheet()).getByRole('button', { name: /premiere/i }))

    expect(within(firstSheet()).getByTestId('wall3d').dataset.skus).toContain('MV-DB24')
  })

  it('closes when someone starts editing, because 3D is for looking', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(firstSheet()).findByTestId('wall3d')

    await user.click(within(firstSheet()).getByRole('button', { name: /edit this wall/i }))

    expect(within(firstSheet()).queryByTestId('wall3d')).not.toBeInTheDocument()
    expect(within(firstSheet()).getByRole('img', { name: /front elevation/i })).toBeInTheDocument()
  })

  it('is not offered without WebGL', () => {
    state.webgl = false
    show()
    expect(within(firstSheet()).queryByRole('button', { name: 'See it in 3D' })).not.toBeInTheDocument()
  })

  it('falls back to the drawing with a note if the 3D view fails', async () => {
    state.explode = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(firstSheet()).findByText('We couldn’t show this wall in 3D on this device.')).toBeInTheDocument()
    expect(within(firstSheet()).getByRole('img', { name: /front elevation/i })).toBeInTheDocument()
    expect(within(firstSheet()).queryByRole('button', { name: 'See it in 3D' })).not.toBeInTheDocument()
  })

  it('works on a shared design too', async () => {
    const user = userEvent.setup()
    const saved = solved.options[0].premiere
    show({ options: [{ label: 'Your saved wall', standard: saved, premiere: saved }], failure: null, notices: [] })

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect((await within(firstSheet()).findByTestId('wall3d')).dataset.skus).toContain('MV-DB24')
  })

  it('records opening 3D in the funnel', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(events).toContainEqual(expect.objectContaining({ name: 'view_3d_opened', properties: { rank: '0', tier: 'Standard' } }))
  })
})
```

- [ ] **Step 4: Run to confirm they fail**

Run: `cd web && npx vitest run src/components/__tests__/ThreeD.test.tsx`
Expected: FAIL — `../../three/support` and `../../three/Wall3D` do not resolve (or, once they exist, "See it in 3D" is not found).

- [ ] **Step 5: Create `support.ts` and `ThreeBoundary.tsx`**

```ts
// web/src/three/support.ts
/** Whether this browser can draw the 3D view. Never throws, and never imports Three.js. */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
```

```tsx
// web/src/three/ThreeBoundary.tsx
import { Component, type ReactNode } from 'react'

/** If the 3D view throws — no context, a lost context, a driver bug — report it and render nothing. */
export class ThreeBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
```

- [ ] **Step 6: Create `Wall3D.tsx`, the only Three.js file.** Colours are taken from `web/src/styles/tokens.css`: `--slab #b9bdc0`, `--slab-edge #9aa0a6`, `--ink #15171a`, `--wood #b5793a`.

```tsx
// web/src/three/Wall3D.tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LayoutDto, WallDto } from '../api/types'
import { buildScene, frameCamera, type MaterialKey } from './buildScene'

/*
  The only file in the app that touches Three.js. Everything it draws comes from buildScene(), which
  is plain data and unit-tested; this file just turns boxes into meshes, points a camera at them and
  cleans up after itself. It renders when something changes, never in a loop.
*/

const FOV = 35
const OPENING_ANGLE = { azimuthDeg: -22, elevationDeg: 10 }

const MATERIALS: Record<MaterialKey, THREE.MeshStandardMaterialParameters> = {
  carcass: { color: 0x9aa0a6, roughness: 0.85 },
  front: { color: 0xb9bdc0, roughness: 0.6 },
  pull: { color: 0x15171a, roughness: 0.4, metalness: 0.2 },
  counter: { color: 0xb5793a, roughness: 0.7 },
  wall: { color: 0xf4f4f2, roughness: 1 },
  floor: { color: 0xdcdbd6, roughness: 1 },
  ghost: { color: 0x9aa3ad, roughness: 1, transparent: true, opacity: 0.22, depthWrite: false },
}

export default function Wall3D({ layout, wall }: { layout: LayoutDto; wall: WallDto }) {
  const host = useRef<HTMLDivElement>(null)
  const frontView = useRef<() => void>(() => undefined)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdcdbd6, 1.8))
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(wall.length * 0.3, wall.ceiling * 1.8, 220)
    scene.add(key)

    // One unit cube, scaled per box: a single geometry however big the wall is.
    const unit = new THREE.BoxGeometry(1, 1, 1)
    const materials = Object.fromEntries(
      Object.entries(MATERIALS).map(([name, params]) => [name, new THREE.MeshStandardMaterial(params)]),
    ) as Record<MaterialKey, THREE.MeshStandardMaterial>

    for (const box of buildScene(layout, wall)) {
      const mesh = new THREE.Mesh(unit, materials[box.material])
      mesh.scale.set(box.w, box.h, box.d)
      mesh.position.set(box.x + box.w / 2, box.y + box.h / 2, box.z + box.d / 2)
      scene.add(mesh)
    }

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minAzimuthAngle = -Math.PI / 3 // never round the back of the wall
    controls.maxAzimuthAngle = Math.PI / 3
    controls.minPolarAngle = Math.PI / 4
    controls.maxPolarAngle = Math.PI / 2 - 0.02 // never under the floor

    const render = () => {
      renderer.render(scene, camera)
      el.dataset.geometries = String(renderer.info.memory.geometries)
      el.dataset.textures = String(renderer.info.memory.textures)
    }

    const resize = () => {
      const width = el.clientWidth || 600
      const height = Math.round(width * 0.62)
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const place = (angle: { azimuthDeg?: number; elevationDeg?: number }) => {
      const frame = frameCamera(wall, FOV, camera.aspect, angle)
      camera.position.set(...frame.position)
      controls.target.set(...frame.target)
      controls.minDistance = frame.distance * 0.35
      controls.maxDistance = frame.distance * 1.6
      controls.update()
      render()
    }

    frontView.current = () => place({})
    resize()
    place(OPENING_ANGLE)
    controls.addEventListener('change', render)

    const observer = new ResizeObserver(() => {
      resize()
      render()
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      controls.removeEventListener('change', render)
      controls.dispose()
      unit.dispose()
      Object.values(materials).forEach((material) => material.dispose())
      renderer.dispose()
      // Browsers cap live WebGL contexts (~16); give this one back now rather than at GC.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [layout, wall])

  return (
    <div className="wall3d">
      <div ref={host} className="wall3d-canvas" />
      <button type="button" className="btn ghost wall3d-front" onClick={() => frontView.current()}>
        Front view
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Add the toggle to `Sheet`** (`web/src/components/Results.tsx`).
  - Change the React import to `import { lazy, Suspense, useEffect, useState } from 'react'`.
  - Add these imports:

```tsx
import { hasWebGL } from '../three/support'
import { ThreeBoundary } from '../three/ThreeBoundary'

// Three.js arrives only when someone asks for it; it never touches the main bundle.
const Wall3D = lazy(() => import('../three/Wall3D'))
```

  - Inside `Sheet`, next to the other state:

```tsx
  const [webgl] = useState(hasWebGL)
  const [threeD, setThreeD] = useState(false)
  const [threeDFailed, setThreeDFailed] = useState(false)
```

  - Replace the contents of `<div className="drawing">` with:

```tsx
        <div className="drawing">
          {threeD && !threeDFailed ? (
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
          ) : (
            <Elevation
              layout={editor.layout}
              wallLength={wall.length}
              ceiling={wall.ceiling}
              obstructions={wall.obstructions ?? []}
              id={`sheet-${rank}-${tier.toLowerCase()}`}
              selected={editing ? selected : null}
              onSelect={editing ? setSelected : undefined}
              onReorder={editing ? onMove : undefined}
            />
          )}

          {threeDFailed && (
            <p className="dims" role="status">
              We couldn’t show this wall in 3D on this device.
            </p>
          )}

          {webgl && !threeDFailed && !editing && (
            <button
              type="button"
              className="linklike"
              aria-pressed={threeD}
              onClick={() => {
                if (!threeD) track('view_3d_opened', configId, { rank: String(rank), tier })
                setThreeD(!threeD)
              }}
            >
              {threeD ? 'Back to the drawing' : 'See it in 3D'}
            </button>
          )}
        </div>
```

  - In the existing "Edit this wall" `onClick`, add `setThreeD(false)` next to `setSelected(null)`. 3D is for looking; editing happens on the drawing.

- [ ] **Step 8: Style.** Append to `web/src/styles.css`:

```css
/* The 3D view sits where the drawing was, same width, with Front view tucked in its corner. */
.wall3d { position: relative; }
.wall3d-canvas canvas { display: block; width: 100%; height: auto; border-radius: 6px; touch-action: none; }
.wall3d-front { position: absolute; right: 8px; bottom: 8px; min-height: 36px; padding: 6px 12px; font-size: 14px; }
```

- [ ] **Step 9: Run the tests**

Run: `cd web && npm test -- --run`
Expected: PASS, including the seven new ThreeD tests.

- [ ] **Step 10: Build and confirm Three.js stayed out of the main bundle**

Run: `cd web && npx tsc -b && npm run build && npm run check:bundle`
Expected:
- the build lists a separate `Wall3D-*.js` chunk of roughly 150 KB gzipped;
- `check-bundle` passes (entry ≤ 58,200 bytes, no `WebGLRenderer`).

If the entry is over budget, stop and report the number. Do not raise the limit.

- [ ] **Step 11: Real-browser smoke check.** With `npm run dev` running, open `http://localhost:5173/?demo=vignette-72` at 1366 × 900. Click "See it in 3D" on card 1 and take a screenshot. Check:
  - it opens at an angle;
  - gray slabs, black pulls and the wood top are visible;
  - the knee space is open;
  - "Front view" squares it up;
  - Premiere shows drawer banks.

Fix anything wrong before committing.

- [ ] **Step 12: Commit**

```bash
git checkout -- web/tsconfig.tsbuildinfo
git add web/package.json web/package-lock.json web/src
git commit -m "See it in 3D: lazy, view-only Three.js view per card, falls back to the drawing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Session 10 — Polish and prototype build

### Task 8: Real-browser pass on desktop and phone

This task is verification-led. Each check has an explicit pass condition; fix whatever fails, with a test where one can be written, then re-run the check.

**Files:**
- Modify: whichever of `Wall3D.tsx`, `Results.tsx`, `Elevation.tsx` and `styles.css` a failed check points at.
- Test: add a regression test to the matching test file for any defect that is observable in jsdom.

- [ ] **Step 1: Start the full stack** (README "Running it locally"): Azurite, `func start --script-root src/GarageConfigurator.Api`, `cd web && npm run dev`.

- [ ] **Step 2: Desktop, 1366 × 900.** On a live solve (240″, a water heater, Workbench), check:
  - 3D opens on card 1;
  - orbiting cannot reach behind the wall or below the floor;
  - zoom stops at sensible limits;
  - Front view squares up;
  - the tier switch updates 3D live;
  - the obstruction ghost sits where the 2D outline is.

  Screenshot each to `.playwright-mcp/phase2-desktop-*.png`.

- [ ] **Step 3: Phone, 390 × 844.** Repeat Step 2, plus these checks:
  - the canvas fits the card with no horizontal page overflow (`document.documentElement.scrollWidth <= innerWidth`);
  - the page still scrolls when a swipe starts outside the canvas;
  - Move left/right work from the panel.

- [ ] **Step 4: Thirty-foot wall under CPU throttling.** Solve 360″ with Storage. Then, through `browser_run_code_unsafe`:

```js
async (page) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const started = Date.now()
  await page.getByRole('button', { name: 'See it in 3D' }).first().click()
  await page.locator('.wall3d-canvas[data-geometries]').first().waitFor()
  const ms = Date.now() - started
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return ms
}
```

  Pass: under 1000 ms after the first load. Run it twice and report the second result, because the first includes downloading the chunk.

- [ ] **Step 5: GPU memory does not grow.** Open and close 3D on all three cards in both tiers (six opens). After each open, read `document.querySelector('.wall3d-canvas').dataset` and record it.
  - Pass: `geometries` is `1` and `textures` is `0` on every open.
  - Pass: `browser_console_messages` shows no "Too many active WebGL contexts" warning after the six opens.
  - A rising count or that warning means something is not disposed; fix the cleanup in `Wall3D.tsx`.

- [ ] **Step 6: No-WebGL fallback.** Through `browser_run_code_unsafe`:

```js
async (page) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null })
  await page.goto('http://localhost:5173/?demo=vignette-72')
  return await page.getByRole('button', { name: 'See it in 3D' }).count()
}
```

  Pass: `0`, and the 2D drawings render normally. Then reload in a new page without the init script so later checks are unaffected.

- [ ] **Step 7: Reorder end to end.** In edit mode on a live solve, check:
  - drag a base one place → one validate + price pair (`browser_network_requests` filter `/api/(validate|price)`);
  - the total updates;
  - "undo my changes" restores it;
  - a move that strands the knee space shows the validator message and "Fix the wall first".

- [ ] **Step 8: Funnel events reach the API.** Filter `/api/events` in the network list and confirm one `view_3d_opened` and one `layout_reordered` request, each answered `202`.

- [ ] **Step 9: Commit any fixes**

```bash
cd web && npm test -- --run && npx tsc -b && npm run build && npm run check:bundle && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add web/src
git commit -m "Phase 2 browser pass: <one line per fix>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Skip the commit if nothing needed fixing, and say so in the hand-off.

---

### Task 9: Docs and hand-off

**Files:**
- Modify: `README.md` (test counts; how to try 3D locally)
- Modify: `docs/DECISIONS.md` (anything decided during the build)
- Modify: `docs/PLAN.md` (mark Sessions 8–10 done)

- [ ] **Step 1: Count tests.** Run `dotnet test` (must still be 451 Core + 108 API, unchanged) and `cd web && npm test -- --run`. Note the web count.

- [ ] **Step 2: Update `README.md`.**
  - Update the web test count in "Running it locally".
  - Under the demo-fixture sentence, add: "`?demo=vignette-72`, then **See it in 3D** on any card, shows the 3D view without the API."

- [ ] **Step 3: Update `docs/DECISIONS.md`.** Add one row per decision actually made while building, dated the build day. At minimum record:
  - **the opening camera angle** (−22° azimuth, 10° elevation) and why it opens angled;
  - **opening "Edit this wall" closes 3D;**
  - **the measured numbers:** the 3D chunk's gzipped size and the entry chunk's final gzipped size;
  - **anything Task 8 changed.**

- [ ] **Step 4: Update `docs/PLAN.md`.** Append " — done <date>" to each of the Session 8, 9 and 10 headings.

- [ ] **Step 5: Final verification and commit**

```bash
dotnet test
cd web && npm test -- --run && npx tsc -b && npm run build && npm run check:bundle && cd ..
git checkout -- web/tsconfig.tsbuildinfo
git add README.md docs
git commit -m "Phase 2 docs: decisions, counts, how to see the 3D view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
