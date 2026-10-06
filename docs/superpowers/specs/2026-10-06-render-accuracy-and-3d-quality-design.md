# Render accuracy and 3D quality — design

Date: 2026-10-06 · Owner: Joshua (product) · Status: approved in conversation, awaiting spec review

## Intent

The manufacturer supplied 23 cleared, full-resolution renders: one per SKU, plus the bar pull. RTA will
also use them on the garage product cards. The planner should look like *these* cabinets, because
customers compare our drawing with the product photos on the store.

There are two pieces of work:

1. **Accuracy (core, on `v1a`).** The 2D drawing matches the renders: legs, the right door and drawer
   arrangement for every SKU, pull positions and colors. Product photos appear in the parts list and
   the cabinet panel. Every version (1B, 1C, 2.0) inherits this.
2. **1D: 3D quality (optional, a new branch from `v1c-3d`).** The 3D view opens in a large pop-up and
   is modeled to the renders' standard.

The team-ownership constraint from Phase 2 still applies:

- 3D stays procedural, built from data, with no model files.
- Three.js stays inside `web/src/three/`.
- The page everyone loads must not grow with the images.

## The reference renders

- **Location:** `assets/reference/sku-renders/`. These are the originals, ~280 MB in total and
  4–6k px each.
- **Not in git:** `assets/reference/` goes in `.gitignore`. The originals are the reference; the repo
  carries only small derived files (see "Derived assets").
- **Usage:** cleared for use on the website (Joshua, 2026-10-06).

## What the renders show, and what changes

| Detail | Renders | Drawing today | Change |
|---|---|---|---|
| **Legs** | Four brushed-stainless adjustable legs on every base, drawer base, waste pullout and pantry. Two-stage cylinder (wider upper sleeve, slimmer foot). Set in from the corners. Open underneath, no kick panel. Adjustable 4″–6.25″ (Joshua). | None | Draw legs. Wall cabinets, fillers and counters have none. |
| **Leg height** | — | — | The listed 34.5″ (base) and 84″ (pantry) include the legs at their **lowest, 4″, setting**. The box is 30.5″ (base) and 80″ (pantry), so every layout, price and the 84″ datum stay unchanged. *Confirm with the vendor spec — see DECISIONS "Needs Joshua".* |
| **MV-B15** | A drawer over one door. Left- and right-hinged renders exist. | One full-height door | Drawer over door, hinged left (pull on the right) as the default render. |
| **MV-B24, MV-B30** (non-F) | A drawer over two doors | Two full-height doors | Drawer over a pair. The -F SKUs stay full-height pairs. |
| **MV-BWB15-PS** | A drawer over a pull-out door | One drawer front | Drawer over a single full-width door. |
| **Pantries** (PC2484, PC3084) | Four doors: a short upper pair (~40% of the height) and a tall lower pair. Pulls sit either side of the split. | Two full-height doors | Upper and lower pairs, with pulls at the split. |
| **Pull position** | Base doors: near the top. Wall doors: near the bottom. Drawers: centered, horizontal. | Doors pulled at mid-height | Positions as in the renders. |
| **3-drawer bases** | A short top drawer, deeper drawers below | Equal drawers | Graduated, proportions measured from the renders. |
| **Finish color** | Medium-dark textured gray, sampled **#787A7B** | Light gray #B9BDC0 | Tokens updated from the renders. |
| **Butcher block** | Lighter amber with visible strips, sampled ~**#E1A570** | #B5793A | Tokens updated. In 3D, a real grain texture (1D). |

Proportions not stated above (leg inset, pull length, drawer split, pantry split) are **measured from
the renders** and recorded as named constants with a comment saying which render they came from.

## Piece 1 — accuracy on `v1a`

### How it is built

- **The shared front description moves to `v1a`.** 1C extracted `web/src/geometry/fronts.ts` from
  `Elevation.tsx`. That commit is a pure refactor (snapshots unchanged), so it is cherry-picked onto
  `v1a` first. Every accuracy change then lives in one place, and 1C's 3D view inherits the fixes
  automatically.
- **`fronts.ts` grows from "doors or drawers" to a per-SKU front layout:**
  - drawer-over-door;
  - drawer-over-pair;
  - upper-and-lower pairs;
  - graduated drawers;
  - pull positions by zone.

  It also gains **`legs(item)`**, which returns the leg rectangles.

  The rule for which layout a SKU gets lives in one function. It is driven by the SKU's catalog
  `type` and name where possible, and by a small explicit table where not, so a new SKU is a one-line
  change.
- **`Elevation.tsx`:**
  - draws the shortened box, then the legs as stainless (`--steel`) rects with a slightly narrower
    lower foot;
  - leaves the floor visible between the legs;
  - keeps knee spaces, counters and fillers as today.
- **Snapshot tests change on purpose.** Each SKU's front layout and its legs get explicit unit tests
  first. The snapshots are then regenerated, and the diff is reviewed in the browser against the
  renders before committing.

### Product photos

- **In the parts table:** a small image (~48px) beside each SKU.
- **In the selected-cabinet panel:** a larger image (~160px). The swap options get thumbnails too.
- **Images:** WebP, two sizes per SKU (~96 px and ~320 px, retina-ready), served as static files from
  `web/public/renders/`.
- **Lazy loading:** `loading="lazy"` with explicit width and height, so images never move the layout
  as they arrive.
- **Accessibility:** alt text is the catalog name.
- **Missing images:** a SKU with no image (a future SKU, or a knee space) shows no image, not a
  broken one.
- **Bundle:** the images are static files, not imported into the JS bundle. The page everyone loads
  is unchanged; each image is fetched only when its row is on screen.

### Derived assets

A manifest and a build script your team can rerun:

- **`data/render-manifest.json`** maps each canonical SKU to its source filename. This is explicit
  because the filenames are free text: `MV-W3015-2 Door_RT.png` is `IC-MW-W3015`, and MV-B15 has
  Left and Right files.
- **`web/scripts/build-renders.mjs`** (Node, `sharp` as a web devDependency) reads the manifest and
  the originals, trims the white border, and writes:
  - `web/public/renders/<SKU>-96.webp`
  - `web/public/renders/<SKU>-320.webp`
- **A test fails** if any catalog SKU the solver can emit is missing from the manifest.
- **The derived WebP files are committed** (~23 × 2 × ≤40 KB). The originals are not.

## Piece 2 — 1D: 3D quality (`v1d-3d-quality`, from `v1c-3d`)

### The pop-up

- **Opening:** "See it in 3D" opens a modal dialog instead of swapping the card's drawing.
  - **Desktop:** the dialog takes ~90% of the viewport.
  - **Under 1024px:** it is full-screen.
- **Inside the dialog:**
  - the layout's label;
  - the Standard/Premiere switch, which drives the card's own tier, so closing keeps your choice;
  - the total;
  - Front view;
  - a close button.
- **Accessibility:**
  - it uses a native `<dialog>`, which gives a focus trap, Esc to close and inert background
    content;
  - clicking the backdrop closes it;
  - focus returns to the button that opened it.
- **Unchanged from 1C:** the WebGL check, the error fallback and the `view_3d_opened` event. The
  event gains `surface: 'dialog'`.

### Modeled to the renders

All of this stays in `buildScene.ts` (pure, tested) and `Wall3D.tsx` (the only Three.js file):

- **Legs:** two stacked cylinders per leg (sleeve and foot), stainless material, positions from
  `legs()`.
- **Bar pull:** a U-shaped square bar (two posts and a grip) built from the pull close-up, black
  metal. Vertical on doors, horizontal on drawers, positioned by `fronts()`.
- **Softened edges:** doors, drawer fronts and carcass sides use a rounded-box geometry with ~1/16″
  radius, from Three.js's standard add-on, so edges catch light the way the renders do.
- **Finish:** the sampled gray, with a subtle procedural surface noise for the textured-laminate look.
  No image file is needed.
- **Butcher block:** a tileable strip-grain texture cut from `MV-CTHW9825_RT.png` by the
  build-renders script, applied along the counter's length.
- **Lighting and shadows:**
  - image-based ambient light from Three.js's built-in `RoomEnvironment` (no HDR file);
  - one soft shadow-casting key light;
  - contact shadows under legs and cabinets on the floor.
- **Not attempted:** photoreal parity with offline renders. The bar is "clearly these cabinets,
  convincing at a glance", checked side by side with the renders in the browser pass.

### Performance and size

- **The geometry count grows** (cylinders, pulls, rounded boxes), so instancing is used:
  - one `InstancedMesh` per part type (legs, pulls);
  - one rounded-box geometry per distinct size.
- **Budgets:**
  - a 30 ft wall still opens in under 1 s at 4× CPU throttling;
  - memory stays flat across repeated opens;
  - the 3D chunk may grow by the add-ons used, but `three` stays out of the entry chunk
    (`check:bundle`);
  - the wood texture (~60 KB WebP) loads with the 3D view, not the page.

## Versions

| Version | Branch | Contents |
|---|---|---|
| 1A | `v1a` | + accuracy (legs, front layouts, pulls, colors) + product photos |
| 1B | `v1b-reorder` | merges `v1a` |
| 1C | `v1c-3d` | merges `v1a`; its 3D gains the accurate fronts and legs as plain boxes |
| **1D** | `v1d-3d-quality` (new, from `v1c-3d`) | pop-up + render-quality 3D. Optional. |
| 2.0 | `v2.0` | merges `v1a`; takes 1D only if Joshua approves 1D |

## Measuring it

No new events beyond `surface` on `view_3d_opened`. The prototype review compares cart-add rates as
before.

## Testing

- **`fronts.ts`:**
  - one test per front layout, named after the SKU it covers;
  - pull positions by zone;
  - graduated drawer proportions;
  - `legs()` counts and insets;
  - legs only on floor-standing zones;
  - the box plus legs equals the catalog height exactly.
- **Elevation:**
  - legs drawn, with the floor visible between them;
  - B15, B24, B30, BWB15 and pantries drawn with their correct fronts;
  - snapshots regenerated deliberately, after the browser comparison.
- **Product photos:**
  - every solver-emittable SKU is in the manifest;
  - the parts table and panel render an `<img>` with alt text and dimensions;
  - a SKU without an image renders no `<img>`.
- **`buildScene.ts`:**
  - leg instances per cabinet;
  - pull instances match `fronts()`;
  - all parts inside the wall and above the floor;
  - the counter carries the wood material.
- **Dialog:**
  - opens, closes on Esc, the close button and the backdrop;
  - focus returns to the opener;
  - the tier switch inside updates the card;
  - fallback on failure.
- **Browser pass:**
  - side-by-side screenshots of drawing and 3D against the renders for B15, B24-F, DB30-3, PC3084,
    W2430 and CTHW9825;
  - desktop and 390px;
  - timing and memory as in Phase 2.

## Out of scope

- Opening doors.
- Hinge-side choice for MV-B15.
- Leg-height adjustment in the UI.
- Swapping countertop species.
- AR.
- Model files.
