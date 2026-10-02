# Build plan

Each phase is a sequence of Claude Code sessions. Paste the session prompt verbatim to start.
Finish every session with `dotnet test` green and DECISIONS.md updated.

## Phase 1 — Wall Solver + elevation + add-all-to-cart (target: 3 weeks)

### Session 1 — Domain model + catalog loader
> Read CLAUDE.md, docs/SPEC.md, docs/SOLVER_RULES.md. Create the .NET 8 solution with
> src/GarageConfigurator.Core and tests/GarageConfigurator.Core.Tests. Model Cabinet, Countertop,
> Wall, Obstruction, PlacedItem, Layout, Violation, PriceMap as immutable records (inches as decimal).
> Write a Catalog loader for data/catalog.json. Add tests that assert every rule in the "Catalog facts"
> section (18 cabinets, widths ∈ {3,15,24,30}, counters' idealRun = w − 2, etc.). Don't write the solver yet.

### Session 2 — Validator
> Implement Validate(Layout, Wall) producing typed Violations for every rule in SOLVER_RULES.md
> (vertical grammar, horizontal grammar, counter rules, obstructions). One test per rule, each named
> after the rule. Use data/fixtures/walls.json for wall shapes. Make constants come from catalog.json "constants".

### Session 3 — Solver
> Implement Solve(Wall, Goal, PriceMap) → top 3 Layouts using the DP-over-width search
> described in SOLVER_RULES.md, scored by the goal heuristics. All three layouts share the requested goal. Add a golden-file test per fixture wall
> that snapshots the SKUs and price of each returned layout. Add a benchmark asserting < 50 ms per solve.

### Session 4 — API
> Create src/GarageConfigurator.Api (Azure Functions isolated, .NET 8) with POST /solve, POST /validate,
> POST /price, GET /design/{configId}, POST /design. Persist designs in Azure Table Storage (local
> Azurite for dev). Generate 6-char base32 config_ids. OpenAPI doc. Integration tests with the fixtures.

### Session 5 — Web wizard + SVG elevation
> Scaffold web/ with Vite + React + TS. Build the 3-step wizard from SPEC.md and a results view with
> three cards. Write an <Elevation> component that renders a Layout as a true-proportion SVG front
> elevation (gray slab fronts, black bar pulls, wood-tone counter, filler strips, obstruction ghosts).
> Mobile-first. Vitest snapshot tests for Elevation against the fixture layouts.

### Session 6 — Editor + cart + share
> Tap-to-select cabinets in the elevation, side panel with swap/remove, live re-validate/re-price via
> API. "Add entire wall to cart" calls the nopCommerce endpoint (see DECISIONS.md — needs the endpoint).
> Share URL /garage/design/{configId}. Lead capture forms. App Insights events per SPEC.md funnel.

### Session 7 — Deploy
> Bicep for Static Web App + Function App + Table Storage + App Insights. GitHub Actions: build, test,
> deploy to a `garage-dev` environment. README with runbook.

## Phase 2 — 3D (Three.js scene, drag-to-rearrange, GLB/USDZ export, counter stain toggle)
## Phase 3 — AI edges (photo intake via Azure OpenAI vision, intent chat, deterministic render → style pass, AR Quick Look)
