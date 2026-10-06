// web/scripts/bake-preview.ts
// Bakes real solver answers and the product images into the shareable prototype (npm run build:preview).
// Needs the API running locally (README "Running it locally"). Output is generated, not committed.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { addCell, createGrid, GRID } from '../src/preview/codec'

const API = process.env.PREVIEW_API ?? 'http://localhost:7071/api'
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const out = here('../src/preview/generated/')
mkdirSync(out, { recursive: true })

const grid = createGrid()
let count = 0
for (let length = GRID.minLength; length <= GRID.maxLength; length += GRID.step) {
  for (const ceiling of GRID.ceilings) {
    for (const goal of GRID.goals) {
      const response = await fetch(`${API}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wall: { length, ceiling, obstructions: [] }, goal }),
      })
      if (!response.ok) throw new Error(`solve ${length}/${ceiling}/${goal} failed: ${response.status}`)
      addCell(grid, length, ceiling, goal, await response.json())
      count++
    }
  }
}
writeFileSync(out + 'grid.json', JSON.stringify(grid))
console.log(`baked ${count} walls`)

// Product images and the wood texture as data URIs: the Artifact viewer loads nothing from outside the page.
const assets: Record<string, string> = {}
for (const dir of ['renders', 'textures']) {
  for (const file of readdirSync(here(`../public/${dir}`))) {
    if (!file.endsWith('.webp')) continue
    assets[`${dir}/${file}`] = 'data:image/webp;base64,' + readFileSync(here(`../public/${dir}/${file}`)).toString('base64')
  }
}
writeFileSync(out + 'assets.json', JSON.stringify(assets))
console.log(`embedded ${Object.keys(assets).length} images`)
