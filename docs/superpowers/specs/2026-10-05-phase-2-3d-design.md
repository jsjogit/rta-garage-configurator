# Phase 2 design — 3D view and reorder

Date: 2026-10-05 · Owner: Joshua (product) · Status: approved in conversation, awaiting spec review

## Intent

**Goal: confidence to buy.** A customer who already has a priced layout should be able to see it in
perspective, turn it, flip Standard/Premiere and believe it is a real wall. That should lead to
more cart adds. Phase 2 also adds one small editing move: reordering cabinets.

**Constraint that shapes everything:** RTA's team must be able to build and maintain this if the
prototype is approved. Joshua is wary of scope creep. Every choice below prefers less 3D code, fewer
libraries and fewer concepts, even where a richer option would look better.

**Out of the MVP entirely (Joshua, 2026-10-05):**
- the counter stain toggle;
- GLB/USDZ export;
- AR (Quick Look / Scene Viewer), including the Phase 3 AR item.

**Also not in Phase 2:**
- editing in 3D;
- opening doors;
- materials or room choices;
- side walls;
- screenshots.

## What the customer sees

### 3D view

- Each result card gets a **"See it in 3D"** toggle beside the drawing. The 2D elevation remains the
  default. The 3D view replaces it inside the same card, so the parts table, price and cart button do
  not move.
- **What is drawn:**
  - **Cabinets:** gray slab fronts with door/drawer reveals, matte black bar pulls, and the
    butcher-block top. Knee spaces are left open.
  - **Room:** a plain back wall and floor. Obstructions are translucent ghosts, the 3D twin of the
    2D dashed outlines.
  - **Lighting:** soft and neutral. The aim is clean, not photo-real.
- **Controls:**
  - Drag to orbit, inside limits: no view of the back of the wall, none from under the floor.
  - Pinch or scroll to zoom.
  - A **Front view** button snaps back to straight-on.
- **It always matches the card:**
  - The card's Standard/Premiere switch updates the 3D view live.
  - Edits made in the 2D editor appear when 3D is next opened.
  - 3D always renders the exact layout the parts table is pricing.
- **Phones:** the same view runs inside the card. The page always scrolls; orbiting needs a drag
  that starts on the model.
- **Fallback:** if WebGL is unavailable, the toggle is not shown. If rendering fails after opening,
  the card returns to the 2D elevation with a one-line note. Neither path can affect price or cart.

### Reorder in the 2D editor

After "Edit this wall", a cabinet can be dragged sideways past its neighbour to trade places.
Swap and remove are unchanged. The rules are deliberately small:

- **A move stays inside its own row.** The floor row covers bases, talls and knee spaces. The wall
  row covers wall cabinets. Nothing changes rows.
- **A move stays inside its unbroken stretch.** A gap left for an obstruction ends a stretch, so a
  cabinet cannot hop over a window or door.
- **Fillers and countertops never move.**
- **The stretch is re-packed from its left edge in the new order.** Total width is unchanged, so a
  reorder can never create a gap or an overlap.
- **One drop is one edit.** While dragging, the drawing previews the new order. On release, the edit
  goes through the same API validate + price as a swap, and undo works the same way.
- **The validator stays the authority.** Moves that break a rule (a tall moved under the counter, a
  knee space moved to a run end) get the existing violation copy and "Fix the wall first". The drag
  itself enforces nothing beyond the row and stretch rules above.
- **Mobile and keyboard:**
  - The selected-cabinet panel gets **Move left / Move right** buttons.
  - With a cabinet selected, the arrow keys do the same.
  - These are the dependable path. Dragging is the quick path on desktop.

**Known, accepted effect:** moving a knee space does not carry the 15" bridge above it. The result
is valid (no rule requires alignment) but untidy. Linking them is deferred until customers show
they do it.

## How it is built

Approach: plain Three.js, view-only, with the reorder in the existing 2D editor. React Three Fiber
was rejected because the team would have to learn two layers. A fake-3D isometric SVG was rejected
because a view you can turn is most of the confidence effect.

### Units

| File | Does | Depends on |
|---|---|---|
| `web/src/geometry/fronts.ts` | Describes a cabinet's fronts as plain rectangles in inches: door/drawer faces, reveals, pulls. Extracted from `Elevation.tsx` (`Fronts`, `drawerCount`). | `PlacedItemDto` |
| `web/src/components/Elevation.tsx` | Unchanged output; now draws `fronts()` as SVG. | `fronts.ts` |
| `web/src/three/buildScene.ts` | Pure: `(layout, wall) → Box[]`. Each box has a size, position and material key: `carcass`, `front`, `pull`, `counter`, `wall`, `floor` or `ghost`. No Three.js import. | `fronts.ts`, API types |
| `web/src/three/Wall3D.tsx` | The only file that imports Three.js. Turns boxes into meshes and sets up renderer, camera, `OrbitControls` with clamped angles, lights, resize and full disposal on unmount. Renders on demand, not every frame. | `three`, `buildScene.ts` |
| `web/src/editor/reorder.ts` | Pure: `reorder(layout, index, direction or targetIndex) → LayoutDto`, applying the row, stretch and re-pack rules. | API types |
| `web/src/hooks/useWallEditor.ts` | Gains `move(index, to)`, which goes through the same validate + price path as `swap`. | `reorder.ts` |
| `web/src/components/Results.tsx` / `CabinetPanel.tsx` | Adds the 3D toggle (`Wall3D` via `React.lazy`), drag handling on the elevation in edit mode, and Move left/right buttons. | the above |

### Data flow

1. **No new API, no Core change, no model files.** The layout DTO already carries `sku, x, y,
   width, height, depth, zone` for every item, which is all the 3D view needs.
2. **One description of the fronts, drawn twice.** 2D and 3D both read `fronts.ts`, so the two views
   cannot disagree about doors, drawers or pulls.
3. **Three.js loads lazily.** `Wall3D` and `three` (~150 KB gzipped) arrive only on the first
   "See it in 3D", not in the main bundle.

### Dependency

`three` is added to `web/` only. Core and the API are untouched. Recorded in DECISIONS.md.

## Measuring it

Two new funnel events go through the existing `/api/events` path into App Insights:

- `view_3d_opened` with properties `rank` and `tier`;
- `layout_reordered` with properties `rank` and `row`.

At prototype review, compare `cart_add_all` rates for sessions with and without `view_3d_opened`.

## Testing

- **`fronts.ts` extraction:** the existing Elevation snapshot tests must pass **unchanged**. That
  proves the refactor changed nothing.
- **`buildScene.ts` unit tests:**
  - box counts and positions on fixture walls;
  - per-SKU drawer and pull counts;
  - a knee space yields no carcass;
  - obstructions yield ghosts;
  - Standard and Premiere differ where the tiers differ;
  - everything sits inside the wall and on the floor.
- **`reorder.ts` unit tests:**
  - row and stretch boundaries;
  - fillers and tops never move;
  - total width is preserved;
  - no gaps and no overlaps;
  - moving at a stretch end is a no-op.
- **Editor tests:**
  - drag, buttons and arrow keys each produce exactly one validate + price round trip;
  - undo restores the original;
  - a rule-breaking move shows the validator's message and blocks the cart.
- **`Wall3D` is checked in a real browser, not unit-tested,** because jsdom has no WebGL. The check
  covers desktop and 390px phone screenshots, tier switching, orbit limits, Front view, and the
  WebGL-disabled fallback.
- **Performance:**
  - the main bundle stays within 2 KB gzipped of the Phase 2 starting point, 56.2 KB measured at
    `6ef976d` (limit 58,200 bytes; a CI step fails the build otherwise);
  - a 30 ft wall opens in 3D in under 1 s with Chrome's 4x CPU throttling at 390px;
  - no growth in `renderer.info.memory` geometries/textures after opening and closing 3D across all
    three cards and both tiers.

## Sessions

- **Session 8 — Reorder in the 2D editor.**
  - Contents: `reorder.ts`, editor `move`, drag in edit mode, Move left/right, arrow keys, tests.
  - First because it has value even if 3D is not approved.
- **Session 9 — 3D view.**
  - Extract `fronts.ts` (snapshots unchanged).
  - Build `buildScene.ts` with tests, then `Wall3D.tsx`.
  - Add the toggle, lazy loading and the fallback.
- **Session 10 — Polish and prototype build.**
  - Real-browser pass on desktop and phone, and touch handling inside a scrolling page.
  - Funnel events, the bundle-size check, and a final docs pass.

## Doc changes that ship with this spec

- `docs/PLAN.md`:
  - Phase 2 becomes Sessions 8–10 above.
  - The stain toggle and GLB/USDZ export are removed.
  - AR Quick Look is removed from Phase 3.
- `docs/SPEC.md`: future-phase notes drop export and AR.
- `docs/DECISIONS.md`: records the removals, the plain Three.js choice, view-only 3D, reorder in 2D,
  and the `three` dependency.
