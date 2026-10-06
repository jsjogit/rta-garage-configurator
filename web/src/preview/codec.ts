// web/src/preview/codec.ts
import type { Goal, LayoutDto, PricedLayoutDto, SolveResponse, Tier, Zone } from '../api/types'

/*
  The shareable prototype carries real solver answers instead of calling the API. This packs them
  compactly — SKU names, prices, labels and messages are stored once and referenced by index — and
  unpacks them into exactly the SolveResponse the API returned. web/scripts/bake-preview.ts fills it.
*/

export const GRID = {
  minLength: 72, // 6 ft
  maxLength: 360, // 30 ft
  step: 6,
  ceilings: [84, 96, 108, 120],
  goals: ['Workbench', 'Storage', 'HideTheMess', 'Balanced'] as Goal[],
}

export function snapLength(inches: number): number {
  const clamped = Math.min(GRID.maxLength, Math.max(GRID.minLength, inches))
  return GRID.minLength + Math.round((clamped - GRID.minLength) / GRID.step) * GRID.step
}

export function snapCeiling(inches: number): number {
  return GRID.ceilings.reduce((best, c) => (Math.abs(c - inches) < Math.abs(best - inches) ? c : best))
}

/** Prices are whole cents; floating-point multiplication is rounded back to them. */
const cents = (value: number) => Math.round(value * 100) / 100

export const cellKey = (length: number, ceiling: number, goal: Goal) => `${length}|${ceiling}|${goal}`

type Item = [number, number, number, number, number, number, number] // sku, x, y, w, h, d, zone
type Line = [number, number, number] // sku, name, qty — prices come from the grid's price table
interface PackedTier {
  i: Item[]
  l: Line[]
  t: [number, number] // subtotalList, subtotalPromo
  m: [number, number | null, string | null] // label (string index), tier, configId
}
interface PackedCell {
  o: [number, PackedTier, PackedTier][] // option label, standard, premiere
  n: number[] // notices (message index pairs)
  f: number | null // failure
}

export interface Grid {
  strings: string[] // SKUs, names, labels, zones, tiers, codes and messages, each stored once
  messages: [number, number][] // [code, message] string indexes
  prices: Record<number, [number, number]> // sku string index -> [unitList, unitPromo]
  cells: Record<string, PackedCell>
}

export function createGrid(): Grid {
  return { strings: [], messages: [], prices: {}, cells: {} }
}

function intern(grid: Grid, value: string): number {
  let at = grid.strings.indexOf(value)
  if (at < 0) at = grid.strings.push(value) - 1
  return at
}

function internMessage(grid: Grid, code: string, message: string): number {
  const pair: [number, number] = [intern(grid, code), intern(grid, message)]
  let at = grid.messages.findIndex((m) => m[0] === pair[0] && m[1] === pair[1])
  if (at < 0) at = grid.messages.push(pair) - 1
  return at
}

function packTier(grid: Grid, p: PricedLayoutDto): PackedTier {
  return {
    i: p.layout.items.map((it) => [intern(grid, it.sku), it.x, it.y, it.width, it.height, it.depth, intern(grid, it.zone)]),
    l: p.lineItems.map((li) => {
      const sku = intern(grid, li.sku)
      const known = grid.prices[sku]
      if (known && (known[0] !== li.unitList || known[1] !== li.unitPromo)) {
        throw new Error(`${li.sku} is priced two ways in one bake`)
      }
      grid.prices[sku] = [li.unitList, li.unitPromo]
      return [sku, intern(grid, li.name), li.quantity]
    }),
    t: [p.subtotalList, p.subtotalPromo],
    m: [intern(grid, p.layout.label ?? ''), p.layout.tier == null ? null : intern(grid, p.layout.tier), p.layout.configId ?? null],
  }
}

function unpackTier(grid: Grid, t: PackedTier): PricedLayoutDto {
  const s = grid.strings
  const layout: LayoutDto = {
    items: t.i.map(([sku, x, y, width, height, depth, zone]) => ({ sku: s[sku], x, y, width, height, depth, zone: s[zone] as Zone })),
    label: s[t.m[0]] === '' ? null : s[t.m[0]],
    configId: t.m[2],
    tier: t.m[1] == null ? null : (s[t.m[1]] as Tier),
  }
  return {
    layout,
    lineItems: t.l.map(([sku, name, quantity]) => {
      const [unitList, unitPromo] = grid.prices[sku]
      return {
        sku: s[sku],
        name: s[name],
        quantity,
        unitList,
        unitPromo,
        extendedList: cents(unitList * quantity),
        extendedPromo: cents(unitPromo * quantity),
      }
    }),
    subtotalList: t.t[0],
    subtotalPromo: t.t[1],
  }
}

export function addCell(grid: Grid, length: number, ceiling: number, goal: Goal, response: SolveResponse): void {
  grid.cells[cellKey(length, ceiling, goal)] = {
    o: response.options.map((o) => [intern(grid, o.label), packTier(grid, o.standard), packTier(grid, o.premiere)]),
    n: response.notices.map((n) => internMessage(grid, n.code, n.message)),
    f: response.failure ? internMessage(grid, response.failure.code, response.failure.message) : null,
  }
}

export function readCell(grid: Grid, length: number, ceiling: number, goal: Goal): SolveResponse | null {
  const cell = grid.cells[cellKey(length, ceiling, goal)]
  if (!cell) return null
  const s = grid.strings
  const message = (i: number) => ({ code: s[grid.messages[i][0]], message: s[grid.messages[i][1]] })
  return {
    options: cell.o.map(([label, standard, premiere]) => ({
      label: s[label],
      standard: unpackTier(grid, standard),
      premiere: unpackTier(grid, premiere),
    })),
    failure: cell.f == null ? null : message(cell.f),
    notices: cell.n.map(message),
  }
}
