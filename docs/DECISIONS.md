# Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-01 | Standalone repo; Core is a plain .NET library | Keeps solver testable and portable into the nopCommerce solution later |
| 2026-10-01 | SVG elevation in Phase 1, Three.js in Phase 2 | Ship guidance + add-all-to-cart first; 3D is polish |
| 2026-10-01 | Exclude RV-BWB18* inserts from solver | No 18" garage base exists; they are kitchen-line items |
| 2026-10-01 | Catalog height 34.5" for base cabinets is the **installed** height, legs included | Joshua confirmed. Vertical datums in SOLVER_RULES.md stand as written: base top 34.5, counter top 36.0, wall-cabinet bottom 54.0, datum top 84.0. Leg range 4"–6.25" is field adjustment, not a solver variable. |
| 2026-10-01 | MV-BWB15-PS is 34.5" H, not the 30" shown on the site | Joshua confirmed the site figure is a data error (fix pending). It is a normal base: it can sit in a counter run like any other. catalog.json corrected ahead of the site. |
| 2026-10-01 | Solver never emits or price-matches MV-GARAGE-KIT-6 | It is a virtual SKU for marketplace listings, not a real assortment. The product bet is custom per-wall configs added to cart a-la-carte, so kit-matching is dropped from scope entirely. |
| 2026-10-02 | Countertops are cut to length on site | Joshua confirmed. Overhang ≤4" only where a run end is open; cut flush where it butts a tall or wall return, so the Balanced goal is now geometrically buildable. |
| 2026-10-02 | One counter per run, no end-to-end joining in V1; run capped at 98" | Cutting makes long runs possible but joining adds seam/support rules for little V1 value. Longer base runs split into separate counter runs. |
| 2026-10-02 | `budgetMax` dropped from V1 | Joshua: post-V1 feature. Removes the "no full wall fits the budget" ranking problem entirely. Fixture `budget-3k` became `workbench-200`. |
| 2026-10-02 | Three results are three variants of the **chosen** goal | Joshua: the cross-goal spread is post-V1. SPEC's old labels were goal names; replaced with rank-1 "Recommended" plus difference-based labels for 2–3. |
| 2026-10-02 | Obstructions expand into keep-out rectangles with per-type clearance | Joshua: add clearance. ElectricalPanel keep-out is ≥30" wide and floor-to-78" (modeled on NEC 110.26), so a panel at 48" now blocks the floor beneath it — reversing the old "panels only block walls" rule. SideDoor gets 3"/side for casing. Constants are configurable in catalog.json. |
| 2026-10-02 | Filler cap is one per wall end plus one per obstruction edge | Resolves the old "max 2 per wall" vs "or against an obstruction" contradiction. |
| 2026-10-02 | MV-F384 is field-cut to height | Drawn and priced as 3" × 34.5" against a base run; one SKU regardless of cut height. |
| 2026-10-02 | A 15" wall cabinet used alone aligns its top to the 84" datum (bottom 69.0) | Keeps the datum line unbroken where a window or panel blocks a full 30" wall. |
| 2026-10-02 | No valid layout returns zero layouts + a typed reason code | `WallTooShort` below the 15" minimum, customer copy "This wall is too short for our smallest cabinet." |
| 2026-10-02 | Seed prices load into a separate PriceMap, never onto the Cabinet record | Makes "the solver never reads prices at runtime" enforceable by the type system rather than by discipline. |
| 2026-10-02 | Ceiling height is a required customer input (quick-picks 8/9/10 ft, default 96") | Joshua. 96 is a default, not a safe floor: every tall is 84" and the datum tops out at 84, so assuming 96 on an older 84" garage quotes cabinets that do not fit — a delivery-day failure, not a missed upsell. Quick-picks rather than free text keep the 60-second promise. |
| 2026-10-02 | Ceiling gates placement in bands: ≥108 stacked 15" walls, <84 no talls/walls, <36 no layout | Keeps the 84" datum a product constant rather than a ceiling-derived one. New codes `TallsExcludedLowCeiling` (notice) and `CeilingTooLow` (hard). Fixtures added for 84, 120 and 30. |
| 2026-10-02 | Core targets `net8.0`; SDK pinned to 8.0.423 via global.json | Machine defaults to the .NET 10 SDK. Pinning keeps local and CI builds identical. "netstandard-compatible" is satisfied by taking no platform-specific dependency, not by multi-targeting. |
| 2026-10-02 | `CatalogLoader` takes a JSON **string**, not a path or stream | Resolves CLAUDE.md's "Core does no I/O" against PLAN Session 1's "catalog loader". Callers own the file read; a test guards it. |
| 2026-10-02 | Core declares zero NuGet packages; JSON via built-in System.Text.Json | Keeps Core droppable into the nopCommerce solution. `CorePurityTests` parses the csproj to enforce it — checking the compiled assembly does not work, since an unused PackageReference is trimmed from assembly metadata. |
| 2026-10-02 | Assertions use **Shouldly** 4.3.0, not FluentAssertions | FluentAssertions v8+ moved to the Xceed licence (paid for commercial use). Joshua: avoid paid licences. Shouldly is BSD-3-Clause and free. Switched at 46 tests rather than carrying the risk forward. Note `ShouldAllBe` passes on an empty collection where FluentAssertions' `OnlyContain` failed — every such assertion is paired with `ShouldNotBeEmpty()`. This supersedes CLAUDE.md's "xUnit + FluentAssertions". |
| 2026-10-02 | `Wall.Ceiling` is a required constructor parameter, not defaulted | Makes the "ceiling is a required input" decision unskippable at the type level rather than by convention. |
| 2026-10-02 | End gap needs a filler only in the 3"–6" band | SOLVER_RULES said both "≥3\" must be closed with fillers" and ">6\" is a soft penalty" — contradictory, since no filler closes a 16\" gap. A gap of 3\" to under 6\" is a validation error; 6\" or more is an underfilled wall the solver scores down. Rules text updated to match. |
| 2026-10-02 | A placed countertop's `Width` is its cut width; the stock SKU width is the constraint | Found by an end-to-end test: comparing cut width to run width can never fail, so the rule was toothless. The validator now checks the catalog width of the counter's SKU. |
| 2026-10-02 | Obstruction blocking is plain rectangle intersection against the keep-out | "Floor-reaching obstructions block bases and talls; others block only wall cabinets" needs no special case — a window at 40"–64" simply misses a 0"–34.5" base and catches a 54"–84" wall cabinet. Less code, same rule. |
| 2026-10-02 | `Validate` is `new LayoutValidator(catalog).Validate(layout, wall)` | Keeps the documented two-argument call shape while injecting constants and SKU data from catalog.json, per PLAN Session 2. |
| 2026-10-02 | A break in the floor run is exempt from the butt-together rule when a keep-out explains it | Otherwise every wall with a water heater reports a false gap violation. Fillers may likewise sit against a keep-out edge. |

## Needs Joshua
- Confirm the electrical-panel clearance numbers (30" wide, floor to 78") with ops/legal before launch.
- Which nopCommerce endpoint should "add entire wall" call? (bulk add vs. sequential)
- Where should config_id persistence live for Phase 1? (Azure Table Storage proposed)
