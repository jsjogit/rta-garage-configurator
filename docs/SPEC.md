# Product Spec — Garage Wall Solver (Phase 1)

## Problem
The garage cabinet page lists 18 cabinets, 3 countertops and a fixed 6-piece kit. Customers must
pick items one by one with no guidance on how a wall goes together. Result: high consideration
friction, low confidence, slow conversion.

## Goal
In under 60 seconds and with 3 inputs, show the customer a complete, priced, buildable wall of
cabinets they can add to cart in one click — and let them tweak it with live re-pricing.

## Success metrics (instrument from day one)
Funnel events, mirrored in App Insights and the store's ai_* reporting pattern:
`wizard_started → wall_defined → layouts_returned → layout_viewed → layout_edited → cart_add_all →
cart_add_item → order_placed (via config_id attribution)`.
Secondary: share-link created, design emailed, "talk to a designer" clicks.

## Inputs (Phase 1)
1. **Wall length** — number input in inches with ft/in helper, OR quick-picks:
   - Single-car side wall ≈ 240" (20 ft)
   - Two-car back wall ≈ 240" (20 ft) / three-car ≈ 360" (30 ft)
   - "I'll measure" (free input)
2. **Obstructions** — optional list of blocks on the wall: `{type, startX, width, height, bottomY}`.
   Presets: electrical panel, water heater, window, side door, garage-door track zone, outlet.
3. **Goal** — one of: `Workbench`, `Storage`, `HideTheMess`, `Balanced`. Optional `budgetMax`.

## Output
`SolveResponse` with up to 3 ranked `Layout`s. Each layout:
- Ordered list of placed items: `{sku, x, y, w, h, d, zone: Base|Counter|Wall|Tall|Filler}`
- Line items rolled up by SKU with qty, unit price, extended price
- Subtotal (list), subtotal (promo if a promo map is supplied)
- Human label ("Workbench Hub", "Max Storage", "Budget Wall")
- A short `config_id` (base32, 6 chars) persisted so the layout can be reloaded/shared

## UI (Phase 1)
- Step 1: wall length (3 quick-picks + free input) → Step 2: drag obstruction chips onto a wall strip
  → Step 3: goal + optional budget → Results.
- Results: three cards side-by-side, each with an **SVG front elevation** (true proportions, gray
  slab fronts, black bar pulls, wood-tone counter), price, and "Add entire wall to cart".
- Tap any cabinet in the elevation → side panel with SKU, dims, price, swap options (same width,
  same zone), remove. Changes re-validate and re-price instantly (call solver `Validate` + `Price`).
- "Share this design" → URL `/garage/design/{config_id}`.
- "Email me this" and "Have a designer tweak this" → lead capture carrying config_id.

## Non-goals (Phase 1)
No photo upload, no 3D, no AI, no multi-wall rooms, no account requirement.

## Later phases (see PLAN.md)
Phase 2: Three.js 3D scene, drag-to-rearrange, GLB/USDZ export.
Phase 3: photo intake (vision estimates wall length/obstructions), intent chat, deterministic-render →
AI glamour pass, AR Quick Look.
