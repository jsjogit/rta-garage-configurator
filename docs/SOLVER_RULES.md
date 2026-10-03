# Solver Rules — the design grammar

Everything below is derived from the live catalog. Rules marked **[VERIFY]** are assumptions that
need confirmation from product/ops; implement them as configurable constants with these defaults.

## Catalog facts
- One finish (Signature Gray TFL), one door style (slab), matte black bar pulls on everything.
- Widths used: 3 (filler), 15, 24, 30. All cabinets are full-depth boxes; no corner units exist.
- **Base cabinets:** 34.5" H × 24" D. Widths 15/24/30. Types: door (B), drawer bank (DB -3/-4),
  full-height door (B-F), waste pullout (BWB15-PS). All bases are 34.5" H — the 30" H shown on the
  site for BWB15-PS is a data error being corrected; treat it as a normal base.
- **Wall cabinets:** 12" D. 30" H (W1530, W2430, W3030) and 15" H (W2415, W3015 — SKU IC-MW-W3015).
- **Tall/pantry:** 84" H × 24" D. Widths 24/30.
- **Filler:** MV-F384 — 3" W × 84" H × 24" D. Full height, so it closes gaps at wall ends.
- **Countertops:** 50", 74", 98" × 25" D × 1.5" thick. Designed around 24" modules
  (48+2, 72+2, 96+2 overhang).
- **Legs:** adjustable 4"–6.25". The catalog 34.5" is the *installed* height, legs included; leg range is
  field adjustment, not a solver variable.
- **Kit:** MV-GARAGE-KIT-6 is a virtual SKU used only to list this page on marketplaces — not a real
  assortment. The solver never emits it and never price-matches a layout against it. Every layout is
  quoted and added to cart à la carte.
- **SKU aliases:** vendor sheets use a "-SF" suffix for the same box we list as "-F".
  `MV-B24-SF` → `MV-B24-F`, `MV-B30-SF` → `MV-B30-F`. Aliases resolve to the canonical SKU on the way
  in; the solver only ever emits canonical SKUs. The map lives in catalog.json `skuAliases`.
- RV-BWB18GRAY / RV-BWB18GRAYPREMIER are 18" waste-pullout inserts from the kitchen line and there is
  no 18" garage base. Exclude from Phase 1 solver output. **[VERIFY]** whether they belong on the page at all.

## Vertical grammar (Y = height off floor, inches)
- Base run top: 34.5. Counter top: 36.0 (34.5 + 1.5).
- Wall cabinet bottom above a counter run: 54.0 (18" clearance). → 30" wall top = 84.0.
- Pantry/tall top = 84.0. This is the horizontal datum line: **wall-cabinet tops and pantry tops align.**
- 15"-high wall cabinets (MV-W2415, IC-MW-W3015) always top-align to the 84" datum, so their bottom
  sits at 69.0. Their uses, in order:
  - **(primary) a bridge above a knee space** — centred over the gap and width-matched to it, leaving
    head room where someone sits. This is what the vendor vignettes show.
  - (secondary) stacked above a 30" wall (top at 99.0) when ceiling ≥ 108.
  - (secondary) alone above a zone where a full 30" wall is blocked (window, panel), given ≥15" clear.
- Nothing may be placed above a tall cabinet.
- Ceiling height is a **required customer input**, defaulting to 96 (8 ft). It gates what may be placed:
  - **ceiling ≥ 108** — a 15" wall may stack on a 30" wall (top at 99.0).
  - **84 ≤ ceiling < 108** — standard behaviour; datum top 84 fits.
  - **84 ≤ ceiling < 87.4** — wall cabinets yes, **talls no**. A pantry ships fully assembled at 84" × 24",
    so tilting one upright off the floor sweeps √(84² + 24²) ≈ 87.4". Below that it cannot be stood up
    without being taken apart. Return a `TallsNeedTipUpRoom` notice explaining that, and offering a designer.
  - **ceiling < 84** — talls and all wall cabinets are excluded (the 84" datum does not fit). Bases and
    counters only; return a `TallsExcludedLowCeiling` notice so the UI can say why.
  - **ceiling < 36** — nothing fits above a counter run; return zero layouts with reason `CeilingTooLow`.
  96 is a *default*, not a safe floor: assuming it when the real ceiling is 84 quotes talls that cannot be
  installed. The two thresholds are separate constants — `minCeilingForWallCabinets` (84, the datum) and
  `minCeilingForTalls` (87.4, the tip-up sweep) — because a 30" wall cabinet tilts up in any garage.

## Horizontal grammar
- Cabinets butt together with 0" gap.
- Sum of widths of all floor-standing items (bases, talls, fillers) ≤ wall length. Remaining gap at
  ends: 0–2.9" is acceptable as-is; a gap of 3" up to 6" **must** be closed with a filler — one per wall
  end, plus one per obstruction edge where a cabinet butts a keep-out. That band is exactly the range a
  single 3" filler can close down to under 3".
  A gap of 6" or more is not a validation error — no filler can close it. It is an underfilled wall, which
  the solver scores down (soft penalty) rather than rejecting, unless it is adjacent to an obstruction.
- Wall cabinets must sit entirely above base cabinets, counters, or empty floor; never above a tall.
- Any wall carrying an obstruction with a clearance rule also returns an
  `ObstructionsWorthADesignerLook` notice. We solve around it correctly, but clearance is the part a
  customer is least able to judge from a wizard, so we offer a designer rather than ask them to fight
  the UI (see docs/DECISIONS.md).
- Every obstruction is expanded into a **keep-out rectangle** before packing; nothing may overlap it.
  Default keep-out = the obstruction rectangle itself. Per-type expansions live in catalog.json
  `constants.obstructionClearance`:
  - **ElectricalPanel:** keep-out is ≥30" wide (centred on the panel, or the panel width if wider) and runs
    **from the floor to 78"**, regardless of the panel's own bottomY. Modeled on NEC 110.26 working space.
    This means a panel mounted at 48" still blocks the floor beneath it — no base cabinet may sit under a panel.
  - **SideDoor:** keep-out is the door rectangle plus a 3" margin each side for casing.
  - Obstructions that reach the floor (door, water heater) block bases and talls; obstructions that do not
    (window) block only wall cabinets.
- Filler goes only at wall ends or directly against an obstruction keep-out, never between two cabinets.
- `MV-F384` is 84" tall and is **field-cut to height** — against a 34.5" base run it is drawn and priced as a
  3" × 34.5" strip. One SKU regardless of cut height.

## Counter rules
- A counter spans a contiguous run of base cabinets (not talls). BWB15-PS counts as a base in a run.
- Counters are **cut to length on site**. Pick the smallest counter SKU whose width ≥ run width.
  Where a run end is open, leave an overhang of ≤ 4" (preferred ≤ 2"). Where a run end butts a tall
  cabinet or a wall return, cut flush — overhang 0. A counter may never overlap a tall's footprint.
- Preferred run widths are still 48, 72, 96 (exact module fit = least cut waste). Also valid: 45 (15+30)
  under 50, 69 (24+30+15) under 74, 90 (30+30+30) under 98, etc.
- Counters are not joined end-to-end in Phase 1, so one counter serves one run and a counter run is
  capped at 98". A longer base run is split into separate counter runs.
- A placed countertop's width is its **cut** width; the constraint is the stock top it was cut from, which
  must be at least as wide as the run. A 50" top cannot be placed 60" wide.
- A counter run may include **one open knee space**: a 24" or 30" gap between two base cabinets where
  someone can sit. Rules:
  - Width is exactly 24" or 30" — it is a cabinet-module gap, not an arbitrary one.
  - At most one per counter run.
  - Never at either end of the run: a knee space must have a base cabinet on both sides.
  - The counter spans the whole run including the knee space, under the usual overhang limits
    (preferred ≤ 2" per side, max 4").
  - A knee space is **not a product**. It occupies wall length and carries no SKU, so it never reaches
    the quote or the cart. It is `Zone.KneeSpace` with an empty SKU.
- Drawer banks (DB) should be under counter where possible; a counter run with ≥1 DB is a "workbench".

## Tiers
Every returned layout comes in two tiers that share one footprint — same positions, same widths, same
counter, same wall cabinets. Only the base cabinets and therefore the price differ:
- **Standard** — full-height door bases: `MV-B24-F` (24"), `MV-B30-F` (30").
- **Premiere** — drawer bases where the width allows: `MV-DB24-3` / `MV-DB24-4` (24"),
  `MV-DB30-3` / `MV-DB30-4` (30"). The first base in each run takes the 3-drawer unit and the rest
  take the 4-drawer unit.
15"-wide positions have no drawer equivalent in the line, so they are identical in both tiers.

## Goal heuristics (scoring, higher = better)
- **Workbench:** maximise counter length, require ≥1 DB in the run, prefer DB24-4/DB30-4 nearest centre,
  walls above counter for tool storage, talls at ends.
- **Storage:** maximise cubic storage per dollar; favour talls and 30"-wide units; counters optional.
- **HideTheMess:** favour full-height doors (B-F) and talls; minimise open counter; fill the wall end-to-end.
- **Balanced:** one workbench run (72 or 96) centred, flanked by talls; walls above counter.
- Universal bonus: a knee space with a **width-matched 15" wall bridge** above it is strongly preferred —
  this is the shape the vendor vignettes sell.
- Universal penalties: unused wall > 6"; mixed 15/24/30 widths in one run (mild); counter overhang > 2";
  a 30"-high wall cabinet hung above a knee space (it drops into the head room the knee space exists for).
- No budget constraint in V1 — `budgetMax` is deferred to a later phase.
- Tie-break: lower price, then fewer line items.

## Search strategy
Wall lengths are ≤ ~480" and widths are 15/24/30/3, so enumerate floor compositions with DP over
width (state = position, items placed), prune by obstructions, then for each floor composition pick
counter runs and wall rows greedily by goal. Expect < 50 ms per solve. Return top 3 distinct layouts
(distinct = different multiset of SKUs or different counter runs).

## No valid layout
If the wall is shorter than `constants.minWallLength` (15" — the narrowest cabinet), the ceiling is below
`constants.minCeiling` (36"), or every composition is blocked by obstructions, `Solve` returns zero layouts
plus a typed reason code. `WallTooShort` carries the customer-facing copy:
**"This wall is too short for our smallest cabinet."** `CeilingTooLow` is the ceiling equivalent.

## Validation API (used by the editor)
`Validate(Layout, Wall) → List<Violation>` — every rule above produces a typed violation with a
customer-readable message ("A 50″ countertop can't cover this 69″ run — try the 74″").
`Price(Layout, PriceMap) → PricedLayout`.
