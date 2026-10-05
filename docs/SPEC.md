# Product Spec — Garage Wall Solver (Phase 1)

## Problem
The garage cabinet page lists 18 cabinets, 3 countertops and a fixed 6-piece kit. Customers must
pick items one by one with no guidance on how a wall goes together. Result: high consideration
friction, low confidence, slow conversion.

## Goal
In under 60 seconds and in 3 steps, show the customer a complete, priced, buildable wall of
cabinets they can add to cart in one click — and let them tweak it with live re-pricing.

## Success metrics (instrument from day one)
Funnel events, mirrored in App Insights and the store's ai_* reporting pattern:
`wizard_started → wall_defined → layouts_returned → layout_viewed → layout_edited → cart_add_all →
cart_add_item → order_placed (via config_id attribution)`.
Emitted by the browser to `POST /api/events`, which logs them as App Insights custom events. All
except `order_placed` are wired; that one needs the cart hand-off to carry `config_id` into the order,
which waits on the product-id map.
Secondary: share-link created, design emailed, "talk to a designer" clicks.

## Inputs (Phase 1)
1. **Wall length** — number input in inches with ft/in helper, OR quick-picks:
   - Single-car back wall ≈ 120" (10 ft)
   - Two-car back wall ≈ 240" (20 ft) / three-car ≈ 360" (30 ft)
   - "I'll measure" (free input)
1b. **Ceiling height** — same step as wall length, one-tap quick-picks, default 8 ft:
   - 8 ft (96") · 9 ft (108") · 10 ft (120") · free input
   Required, because the line's talls and the 84" datum do not fit under an older 7-ft garage ceiling.
   Not a free-text measurement — it is the one dimension a customer can answer by looking up.
2. **Obstructions** — optional. The customer adds a type (electrical panel, water heater, window,
   side door; more than one of each is fine), which starts at a typical size and place, then enters
   what they measured: inches from the left corner and width for everything, plus height and inches
   off the floor for windows and panels. Doors and water heaters stand on the floor and keep their
   default height. Each obstruction can also be dragged along the wall in the live drawing. The page
   refuses to solve while one runs past the end of the wall or through the ceiling. No custom shapes.
   When a wall carries a clearance-bearing obstruction the results still show a "have a designer
   check this" path alongside the layouts.
3. **Goal** — one of: `Workbench`, `Storage`, `HideTheMess`, `Balanced`.
   (No `budgetMax` in V1 — deferred to a later phase.)

## Output
`SolveResponse` with up to 3 ranked `Layout`s — all three are variants of the **one goal the customer
chose**, not one layout per goal (the cross-goal spread is a post-V1 feature). Each layout:
- Ordered list of placed items: `{sku, x, y, w, h, d, zone: Base|Counter|Wall|Tall|Filler}`
- Line items rolled up by SKU with qty, unit price, extended price
- Subtotal (list), subtotal (promo if a promo map is supplied)
- Human label. Rank 1 is "Recommended"; ranks 2–3 are labelled by how they differ from rank 1
  ("More storage", "Lower cost", "Bigger workbench"). Revisit the wording in Session 5 against real cards.
- A short `config_id` (base32, 6 chars) persisted so the layout can be reloaded/shared

If no layout is possible, `SolveResponse` returns zero layouts and a typed reason code. For a wall under
15" that is `WallTooShort`, shown to the customer as **"This wall is too short for our smallest cabinet."**
For a ceiling under 36" that is `CeilingTooLow`. A ceiling under 84" still solves, but returns a
`TallsExcludedLowCeiling` notice so the UI can explain why no pantries appear.

## UI (Phase 1)
- Step 1: wall length (3 quick-picks + free input) + ceiling height (3 quick-picks, 8 ft default)
  → Step 2: add obstructions, type their measurements or drag them along the live drawing
  → Step 3: goal → Results.
- Results: three cards side-by-side, each with an **SVG front elevation** (true proportions, gray
  slab fronts, black bar pulls, wood-tone counter), price, and "Add entire wall to cart".
- Tap any cabinet in the elevation → side panel with SKU, dims, price, swap options (same width,
  same zone), remove. Changes re-validate and re-price instantly (call solver `Validate` + `Price`).
- "Share this design" → URL `/garage/design/{config_id}`.
- "Email me this" and "Have a designer tweak this" → lead capture carrying config_id.

## Non-goals (Phase 1)
No photo upload, no 3D, no AI, no multi-wall rooms, no account requirement.
No budget cap, and no cross-goal comparison (three layouts always share the chosen goal).

## Later phases (see PLAN.md)
Phase 2: Three.js 3D scene, drag-to-rearrange, GLB/USDZ export.
Phase 3: photo intake (vision estimates wall length/obstructions), intent chat, deterministic-render →
AI glamour pass, AR Quick Look.
