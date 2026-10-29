// web/scripts/check-bundle.mjs
// Phase 2 budget (docs/superpowers/specs/2026-10-05-phase-2-3d-design.md): the page everyone loads may
// grow by at most 2 KB gzipped, and Three.js must only ever arrive in the lazy 3D chunk.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// 2.0 = 1A + 1B + 1C. Joshua approved Phase 2 adding ~2.2 KB over 1A (2026-10-05). 1A is 57,214 bytes after
// the render-accuracy work (was 56,184), so the limit moves with it: 58,400 + 1,030. See DECISIONS 2026-10-06.
const LIMIT = 59_430

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const entry = html.match(/src="\/assets\/(index-[^"]+\.js)"/)?.[1]
if (!entry) {
  console.error('check-bundle: could not find the entry script in dist/index.html — run npm run build first.')
  process.exit(1)
}

const code = readFileSync(new URL(`../dist/assets/${entry}`, import.meta.url))
const size = gzipSync(code).length
const problems = []

if (size > LIMIT) problems.push(`entry chunk is ${size} bytes gzipped; the budget is ${LIMIT}.`)
if (code.includes('WebGLRenderer')) problems.push('Three.js leaked into the entry chunk; it must only load lazily.')

if (problems.length > 0) {
  for (const problem of problems) console.error(`check-bundle: ${problem}`)
  process.exit(1)
}

console.log(`check-bundle: entry chunk ${size} bytes gzipped (budget ${LIMIT}).`)
