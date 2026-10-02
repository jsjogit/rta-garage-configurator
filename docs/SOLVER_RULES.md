# Solver Rules — the design grammar

Everything below is derived from the live catalog. Rules marked **[VERIFY]** are assumptions that
need confirmation from product/ops; implement them as configurable constants with these defaults.

## Catalog facts
- One finish (Signature Gray TFL), one door style (slab), matte black bar pulls on everything.
- Widths used: 3 (filler), 15, 24, 30. All cabinets are full-depth boxes; no corner units exist.
- **Base cabinets:** 34.5" H × 24" D. Widths 15/24/30. Types: door (B), drawer bank (DB -3/-4),
  full-height door (B-F), waste pullout (BWB15-PS — note it is 30" H, not 34.5").
- **Wall cabinets:** 12" D. 30" H (W1530, W2430, W3030) and 15" H (W2415, W3015 — SKU IC-MW-W3015).
- **Tall/pantry:** 84" H × 24" D. Widths 24/30.
- **Filler:** MV-F384 — 3" W × 84" H × 24" D. Full height, so it closes gaps at wall ends.
- **Countertops:** 50", 74", 98" × 25" D × 1.5" thick. Designed around 24" modules
  (48+2, 72+2, 96+2 overhang).
- **Legs:** adjustable 4"–6.25". **[VERIFY]** whether 34.5" H includes legs at minimum setting.
- **Kit:** MV-GARAGE-KIT-6 exists as a fixed-SKU bundle. **[VERIFY]** its BOM so the solver can
  recognise when a layout equals the kit and price it as the kit (cheaper for the customer).
- RV-BWB18GRAY / RV-BWB18GRAYPREMIER are 18" waste-pullout inserts from the kitchen line and there is
  no 18" garage base. Exclude from Phase 1 solver output. **[VERIFY]** whether they belong on the page at all.

## Vertical grammar (Y = height off floor, inches)
- Base run top: 34.5. Counter top: 36.0 (34.5 + 1.5). **[VERIFY]** with leg setting.
- Wall cabinet bottom above a counter run: 54.0 (18" clearance). → 30" wall top = 84.0.
- Pantry/tall top = 84.0. This is the horizontal datum line: **wall-cabinet tops and pantry tops align.**
- 15" wall cabinets may be used (a) above a 30" wall (top at 99.0) when ceiling ≥ 108, or
  (b) alone above zones where a full 30" wall is blocked (window, panel) when there is ≥15" clear.
- Nothing may be placed above a tall cabinet.
- Default ceiling height 96 (8 ft) **[VERIFY]**; accept 108/120 as input.

## Horizontal grammar
- Cabinets butt together with 0" gap.
- Sum of widths of all floor-standing items (bases, talls, fillers) ≤ wall length. Remaining gap at
  ends: 0–2.9" is acceptable as-is; ≥3" must be closed with fillers (max 2 fillers per wall, one per end).
  A gap > 6" at one end is a soft penalty (looks unfinished) unless it is adjacent to an obstruction.
- Wall cabinets must sit entirely above base cabinets, counters, or empty floor; never above a tall.
- Wall cabinets may not overlap an obstruction's rectangle. Bases/talls may not overlap an
  obstruction rectangle that reaches the floor (door, water heater); a panel at height 48+ only blocks walls.
- Filler goes only at wall ends or directly against an obstruction, never between two cabinets.

## Counter rules
- A counter spans a contiguous run of base cabinets (not talls, not the waste pullout alone).
- Counter width ≥ run width. Overhang per side = (counter − run)/2 and must be ≤ 4" (preferred ≤ 2").
- Preferred run widths: 48, 72, 96 (exact module fit). Also valid: 45 (15+30) under 50, 69 (24+30+15)
  under 74, 90 (30+30+30) under 98, etc. — any run where overhang constraint holds.
- Counters cannot be joined end-to-end to make longer runs in Phase 1. **[VERIFY]**
- Drawer banks (DB) should be under counter where possible; a counter run with ≥1 DB is a "workbench".

## Goal heuristics (scoring, higher = better)
- **Workbench:** maximise counter length, require ≥1 DB in the run, prefer DB24-4/DB30-4 nearest centre,
  walls above counter for tool storage, talls at ends.
- **Storage:** maximise cubic storage per dollar; favour talls and 30"-wide units; counters optional.
- **HideTheMess:** favour full-height doors (B-F) and talls; minimise open counter; fill the wall end-to-end.
- **Balanced:** one workbench run (72 or 96) centred, flanked by talls; walls above counter.
- Universal penalties: unused wall > 6"; mixed 15/24/30 widths in one run (mild); counter overhang > 2";
  layout cost > budgetMax (hard reject).
- Tie-break: lower price, then fewer line items.

## Search strategy
Wall lengths are ≤ ~480" and widths are 15/24/30/3, so enumerate floor compositions with DP over
width (state = position, items placed), prune by obstructions, then for each floor composition pick
counter runs and wall rows greedily by goal. Expect < 50 ms per solve. Return top 3 distinct layouts
(distinct = different multiset of SKUs or different counter runs).

## Validation API (used by the editor)
`Validate(Layout, Wall) → List<Violation>` — every rule above produces a typed violation with a
customer-readable message ("A 50″ countertop can't cover this 69″ run — try the 74″").
`Price(Layout, PriceMap) → PricedLayout`.
