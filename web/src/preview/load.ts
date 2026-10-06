// web/src/preview/load.ts
import { assets, gridGzipBase64 } from 'virtual:preview-data'
import type { SolveInput } from '../api/client'
import type { SolveResponse } from '../api/types'
import { setEmbeddedAssets } from './assets'
import { readCell, snapCeiling, snapLength, type Grid } from './codec'

/*
  The prototype's stand-in for the API: real solver answers baked into the page by
  web/scripts/bake-preview.ts, unpacked once in the browser. Only ever loaded in the preview build.
*/
let grid: Grid | null = null

export async function ready(): Promise<void> {
  setEmbeddedAssets(assets)
  if (grid || !gridGzipBase64) return
  const bytes = Uint8Array.from(atob(gridGzipBase64), (c) => c.charCodeAt(0))
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
  grid = JSON.parse(text) as Grid
}

export async function previewSolve(input: SolveInput): Promise<SolveResponse> {
  await ready()
  const answer = grid && readCell(grid, snapLength(input.wall.length), snapCeiling(input.wall.ceiling), input.goal)
  if (!answer) throw new Error('This wall is outside what the prototype has baked in.')
  return answer
}
