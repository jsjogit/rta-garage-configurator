# RTA Garage Configurator — Project Context

## What this is
A customer-facing "Wall Solver" for RTA Cabinet Store's Signature Gray Garage Cabinet line
(https://www.rtacabinetstore.com/garage-cabinets). A customer gives us a wall length, obstructions,
and a goal; we return the best 2–3 complete cabinet layouts built from the real SKU catalog, each
with an exact price and a one-click "add entire wall to cart."

This is NOT an image-generation project. The garage line is a closed, rectilinear, single-finish
system (18 cabinets + 3 countertops), so layout is a deterministic packing problem. AI is used only
at the edges (photo intake, intent parsing, optional style pass) in later phases.

Read `docs/SPEC.md`, `docs/SOLVER_RULES.md`, and `docs/PLAN.md` before starting any task.
`data/catalog.json` is the source of truth for SKUs during development.

## Stack (decisions made — change only if asked)
- **Solver / domain:** .NET 8 class library `src/GarageConfigurator.Core` — pure, no I/O, 100% unit-testable.
- **API:** Azure Functions (isolated worker, .NET 8) `src/GarageConfigurator.Api`. Thin wrappers over Core.
- **Web:** `web/` — React 18 + Vite + TypeScript. Phase 1 renders an SVG elevation; Phase 2 adds Three.js.
- **Tests:** xUnit + FluentAssertions in `tests/GarageConfigurator.Core.Tests`. Vitest for web.
- **Hosting target:** Azure Static Web Apps (web) + Azure Functions (API) + Blob Storage (renders/exports) + App Insights.
- **Store integration:** nopCommerce (custom .NET fork, RTA). Phase 1 integrates via the existing add-to-cart
  endpoints; the solver library is designed to be referenced from the nop solution later.

## Repo layout
```
CLAUDE.md
docs/            SPEC.md, SOLVER_RULES.md, PLAN.md, DECISIONS.md
data/            catalog.json (seed SKU data), fixtures/ (test walls)
src/             GarageConfigurator.Core, GarageConfigurator.Api
tests/           GarageConfigurator.Core.Tests
web/             React app
```

## Commands
```
dotnet build
dotnet test
cd web && npm install && npm run dev
cd web && npm test
func start --script-root src/GarageConfigurator.Api    # local API
```

## Conventions
- Units: inches everywhere, decimal (34.5 not 34 1/2). Money: decimal USD. Never float for either.
- SKU strings are the identity of a cabinet. Never invent a SKU. If a rule needs a cabinet that
  doesn't exist in `catalog.json`, the rule is wrong — flag it in `docs/DECISIONS.md`.
- Every solver rule in `docs/SOLVER_RULES.md` has at least one test that would fail if the rule were removed.
- Pricing in `catalog.json` is a dev seed. Production pricing comes from nopCommerce at request time;
  the solver must accept a price map as input, never read prices from a file at runtime.
- Keep Core free of Azure/ASP.NET/EF references. It must compile as a plain netstandard-compatible library.
- Prefer small PR-sized changes. Update `docs/DECISIONS.md` whenever you resolve an open question.
- Don't add dependencies to Core without noting why in DECISIONS.md.

## Working with the human
- Joshua (Director of Product & Technology) is the product owner. He moves fast and prefers
  working software over long explanations. When a decision is ambiguous, pick the simplest option,
  note it in DECISIONS.md, and keep going.
- Open questions that block correctness (not style) go in DECISIONS.md under "Needs Joshua."
