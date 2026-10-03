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

## Routes

- `/` — the wizard
- `/garage/design/{configId}` — a saved wall, opened from a share link

## Design notes

This runs embedded on rtacabinetstore.com, so it wears the store's clothes. `src/styles/tokens.css`
holds the brand values — they were read off the live garage page with `getComputedStyle` rather than
eyeballed, so the serif headings, Mulish body, navy `#12223b`, pill buttons and sand add-to-cart are
the store's own. Both font stacks fall back sensibly when this runs standalone: FreightDisplay Pro is
an Adobe font we cannot serve ourselves, so Georgia stands in.

Layout is two columns from 1024px: the inputs stay put on the left while the drawing does the moving
on the right. Below that it is one column with the drawing pinned to the top of the viewport as a
115px reference strip, and the result cards become a swipeable deck.

The elevation is drawn in inches with the viewBox doing the scaling, and the 84" datum the solver
enforces is drawn as a datum line so a customer can see why the tops line up. `compact` trims the
drawing margins for the pinned strip without touching proportions.

## Screenshots

`screenshots/` holds the current look at 1366×768 and 390×844. Regenerate by running the dev server
and driving it with the `?demo=` fixtures.
