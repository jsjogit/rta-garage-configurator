import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Elevation, formatInches } from '../Elevation'
import type { SolveResponse } from '../../api/types'

import vignette from '../../fixtures/vignette-72.json'
import clean from '../../fixtures/single-car-clean.json'
import panel from '../../fixtures/two-car-panel.json'
import storage from '../../fixtures/storage-240.json'

const fixtures: Record<string, SolveResponse> = {
  'vignette-72': vignette as SolveResponse,
  'single-car-clean': clean as SolveResponse,
  'two-car-panel': panel as SolveResponse,
  'storage-240': storage as SolveResponse,
}

function svgFor(name: string, tier: 'standard' | 'premiere' = 'standard', obstructions = []) {
  const option = fixtures[name].options[0]
  const priced = tier === 'standard' ? option.standard : option.premiere
  const { container } = render(
    <Elevation
      layout={priced.layout}
      wallLength={name === 'vignette-72' ? 72 : 240}
      ceiling={96}
      obstructions={obstructions}
      id={`${name}-${tier}`}
    />,
  )
  return container.querySelector('svg')!
}

describe('Elevation', () => {
  it.each(Object.keys(fixtures))('renders %s without losing a cabinet', (name) => {
    const option = fixtures[name].options[0]
    const svg = svgFor(name)

    // Every placed item has to appear: a dropped box is a wall the customer cannot build.
    const drawn = svg.querySelectorAll('rect, text').length
    expect(drawn).toBeGreaterThanOrEqual(option.standard.layout.items.length)
  })

  it.each(Object.keys(fixtures))('%s matches its snapshot', (name) => {
    expect(svgFor(name)).toMatchSnapshot()
  })

  it('draws the premiere tier differently from standard', () => {
    expect(svgFor('vignette-72', 'standard').outerHTML).not.toBe(
      svgFor('vignette-72', 'premiere').outerHTML,
    )
  })

  it('scales to the wall rather than to a fixed pixel size', () => {
    expect(svgFor('vignette-72').getAttribute('viewBox')).toBe('-10 -14 92 140')
    expect(svgFor('single-car-clean').getAttribute('viewBox')).toBe('-10 -14 260 140')
  })

  it('draws the 84 inch datum the solver aligns everything to', () => {
    const svg = svgFor('single-car-clean')
    expect(svg.textContent).toContain('84″ datum')
  })

  it('leaves a knee space open instead of drawing a cabinet in it', () => {
    const svg = svgFor('vignette-72')
    expect(svg.textContent).toContain('knee space')
  })

  it('gives drawer banks one pull per drawer', () => {
    const svg = svgFor('vignette-72', 'premiere')
    const pulls = [...svg.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('fill') === 'var(--ink)',
    )

    // Base cabinets sit below y=61.5 in SVG space on a 96" wall; uppers are above it.
    const onTheBases = pulls.filter((r) => Number(r.getAttribute('y')) > 50)
    const onTheUppers = pulls.filter((r) => Number(r.getAttribute('y')) <= 50)

    // MV-DB24-3 has three drawers, MV-DB24-4 has four.
    expect(onTheBases).toHaveLength(7)
    // Three 24" uppers, each a pair of doors.
    expect(onTheUppers).toHaveLength(6)
  })

  it('gives a pair of doors to anything 24 inches or wider', () => {
    const svg = svgFor('vignette-72', 'standard')
    const pulls = [...svg.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('fill') === 'var(--ink)' && Number(r.getAttribute('y')) > 50,
    )

    // Two MV-B24-F door bases, two pulls each.
    expect(pulls).toHaveLength(4)
  })

  it('describes the wall for screen readers', () => {
    const label = svgFor('vignette-72').getAttribute('aria-label')!
    expect(label).toContain('6′ wall')
    expect(label).toContain('MV-B24-F')
    expect(label).toContain('open knee space')
  })

  it('ghosts an obstruction instead of hiding it', () => {
    const svg = svgFor('two-car-panel', 'standard', [
      { type: 'ElectricalPanel', startX: 180, width: 16, height: 30, bottomY: 48 },
    ] as never)

    expect(svg.textContent).toContain('panel')
    expect(svg.querySelectorAll('[stroke-dasharray="4 3"]')).toHaveLength(1)
  })

  it('drops an obstruction label that would run across the cabinets beside it', () => {
    const svg = svgFor('two-car-panel', 'standard', [
      { type: 'Outlet', startX: 100, width: 4, height: 4, bottomY: 40 },
    ] as never)

    // A 4" outlet cannot carry a six-character label; the ghost still shows.
    expect(svg.textContent).not.toContain('outlet')
    expect(svg.querySelectorAll('[stroke-dasharray="4 3"]')).toHaveLength(1)
  })
})

describe('formatInches', () => {
  it.each([
    [72, '6′'],
    [240, '20′'],
    [86, '7′ 2″'],
    [11, '11″'],
    [87.4, '7′ 3.4″'],
  ])('formats %i as %s', (value, expected) => {
    expect(formatInches(value)).toBe(expected)
  })
})

describe('compact mode', () => {
  it('trims the drawing margins so a pinned strip is not mostly empty box', () => {
    const layout = { items: [] }
    const render1 = render(<Elevation layout={layout} wallLength={240} ceiling={96} id="full" />)
    const full = render1.container.querySelector('svg')!.getAttribute('viewBox')!

    const render2 = render(<Elevation layout={layout} wallLength={240} ceiling={96} id="small" compact />)
    const compact = render2.container.querySelector('svg')!.getAttribute('viewBox')!

    expect(full).toBe('-10 -14 260 140')
    expect(compact).toBe('-4 -4 248 114')
  })

  it('keeps true proportions — only the margins change', () => {
    const { container } = render(
      <Elevation layout={{ items: [] }} wallLength={240} ceiling={96} id="c" compact />,
    )
    const [, , width, height] = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number)

    // The wall itself is still 240 x 96 inside the box.
    expect(width).toBeGreaterThanOrEqual(240)
    expect(height).toBeGreaterThanOrEqual(96)
  })

  it('leaves the datum off an empty wall', () => {
    const { container } = render(<Elevation layout={{ items: [] }} wallLength={240} ceiling={96} id="e" />)
    expect(container.textContent).not.toContain('datum')
  })
})

describe('moving an obstruction', () => {
  const window36 = { type: 'Window', startX: 60, width: 36, height: 24, bottomY: 40 }

  function preview(onMove = vi.fn()) {
    const utils = render(
      <Elevation layout={{ items: [] }} wallLength={240} ceiling={96} obstructions={[window36]} id="t" onMoveObstruction={onMove} />,
    )
    const svg = utils.container.querySelector('svg')!
    // jsdom does no layout: pretend the drawing is 520px wide so 2px of pointer = 1 inch of wall.
    const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: width * 2, height: height * 2, right: width * 2, bottom: height * 2, x: 0, y: 0, toJSON: () => ({}) })
    return { ...utils, onMove, handle: utils.getByRole('slider', { name: /window/i }) }
  }

  it('is not draggable unless someone is listening', () => {
    const { queryByRole } = render(
      <Elevation layout={{ items: [] }} wallLength={240} ceiling={96} obstructions={[window36]} id="t" />,
    )
    expect(queryByRole('slider')).not.toBeInTheDocument()
  })

  it('slides along the wall when dragged', () => {
    const { handle, onMove } = preview()

    fireEvent.pointerDown(handle, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 240, pointerId: 1 })

    expect(onMove).toHaveBeenLastCalledWith(0, 80)
  })

  it('cannot be dragged off either end of the wall', () => {
    const { handle, onMove } = preview()

    fireEvent.pointerDown(handle, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 2000, pointerId: 1 })
    expect(onMove).toHaveBeenLastCalledWith(0, 204)

    fireEvent.pointerMove(handle, { clientX: -2000, pointerId: 1 })
    expect(onMove).toHaveBeenLastCalledWith(0, 0)
  })

  it('moves an inch per arrow press, a foot with shift', () => {
    const { handle, onMove } = preview()

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenLastCalledWith(0, 61)

    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(onMove).toHaveBeenLastCalledWith(0, 48)
  })

  it('tells a screen reader where it is', () => {
    const { handle } = preview()
    expect(handle).toHaveAttribute('aria-valuenow', '60')
    expect(handle).toHaveAttribute('aria-valuemax', '204')
  })
})

describe('reordering in edit mode', () => {
  const layout = (vignette as SolveResponse).options[0].standard.layout

  function editable() {
    const onReorder = vi.fn()
    const onSelect = vi.fn()
    const utils = render(
      <Elevation layout={layout} wallLength={72} ceiling={96} id="r" onSelect={onSelect} onReorder={onReorder} />,
    )
    const svg = utils.container.querySelector('svg')!
    // viewBox is "-10 -14 92 140"; pretend it is drawn at 2px per inch.
    const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: width * 2, height: height * 2, right: width * 2, bottom: height * 2, x: 0, y: 0, toJSON: () => ({}) })
    const first = utils.getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0]
    return { ...utils, onReorder, onSelect, first }
  }

  it('drops a cabinet one place along once it passes its neighbour’s middle', () => {
    const { first, onReorder } = editable()

    fireEvent.pointerDown(first, { clientX: 44, pointerId: 1 }) // x = 12, the cabinet's centre
    fireEvent.pointerMove(first, { clientX: 104, pointerId: 1 }) // +30 inches
    fireEvent.pointerUp(first, { clientX: 104, pointerId: 1 })

    expect(onReorder).toHaveBeenCalledWith(0, 1)
  })

  it('ignores a wiggle, so a tap still selects', () => {
    const { first, onReorder, onSelect } = editable()

    fireEvent.pointerDown(first, { clientX: 44, pointerId: 1 })
    fireEvent.pointerMove(first, { clientX: 46, pointerId: 1 })
    fireEvent.pointerUp(first, { clientX: 46, pointerId: 1 })
    fireEvent.click(first)

    expect(onReorder).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('does not treat the end of a drag as a tap', () => {
    const { first, onSelect } = editable()

    fireEvent.pointerDown(first, { clientX: 44, pointerId: 1 })
    fireEvent.pointerMove(first, { clientX: 104, pointerId: 1 })
    fireEvent.pointerUp(first, { clientX: 104, pointerId: 1 })
    fireEvent.click(first)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('moves the focused cabinet with the arrow keys', () => {
    const { first, onReorder } = editable()

    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(onReorder).toHaveBeenLastCalledWith(0, 1)

    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(onReorder).toHaveBeenLastCalledWith(0, -1)
  })

  it('keeps an item’s element when it moves, so keyboard focus stays on it', () => {
    const { container, rerender } = render(
      <Elevation layout={layout} wallLength={72} ceiling={96} id="k" onSelect={vi.fn()} onReorder={vi.fn()} />,
    )
    const before = container.querySelectorAll('[role=button]')[1]
    const moved = { ...layout, items: layout.items.map((i, n) => (n === 0 ? { ...i, x: 24 } : n === 1 ? { ...i, x: 0 } : i)) }
    rerender(<Elevation layout={moved} wallLength={72} ceiling={96} id="k" onSelect={vi.fn()} onReorder={vi.fn()} />)

    expect(container.querySelectorAll('[role=button]')[1]).toBe(before)
  })
})
