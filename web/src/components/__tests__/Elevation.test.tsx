import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
