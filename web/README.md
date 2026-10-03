# Garage Wall Planner — web

Vite + React + TypeScript. Mobile-first.

```
npm install
npm run dev     # http://localhost:5173, proxies /api to the Functions host on :7071
npm test        # vitest
npm run build
```

## Working without the API

`func` is not required to develop the UI. `?demo=<fixture>` renders a stored `/solve` payload:

```
http://localhost:5173/?demo=vignette-72
http://localhost:5173/?demo=two-car-panel      # obstruction + designer notice
http://localhost:5173/?demo=tip-up-84          # no pantries + tip-up notice
http://localhost:5173/?demo=storage-240
http://localhost:5173/?demo=single-car-clean
```

The fixtures in `src/fixtures/` are generated from the real API by
`WebFixtureExportTests` — regenerate with `GOLDEN_UPDATE=1 dotnet test`. That test also fails when
the committed fixtures drift from what the API returns, which is what keeps the web and the solver
honest with each other.

## Design notes

The identity is a shop drawing, because that is what the product is. The palette comes off the
cabinets themselves: the Signature Gray line is entirely grayscale, so the interface is too, and the
one warm note — butcher-block amber — appears only where wood actually appears. The elevation is
drawn in inches with the viewBox doing the scaling, and the 84" datum the solver enforces is drawn
as a datum line so the customer can see why the tops line up.
