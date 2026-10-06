// web/src/components/__tests__/ThreeD.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Results } from '../Results'
import type { LayoutDto, SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'

const state = vi.hoisted(() => ({ webgl: true, explode: false }))

vi.mock('../../three/support', () => ({ hasWebGL: () => state.webgl }))
vi.mock('../../three/Wall3D', () => ({
  default: ({ layout }: { layout: LayoutDto }) => {
    if (state.explode) throw new Error('WebGL context lost')
    return <div data-testid="wall3d" data-skus={layout.items.map((i) => i.sku).join(',')} />
  },
}))

const solved = vignette as SolveResponse
const wall = { length: 72, ceiling: 96 }
let events: { name: string; properties: Record<string, string> | null }[] = []

beforeEach(() => {
  state.webgl = true
  state.explode = false
  events = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/events') events.push(JSON.parse(init!.body as string))
      return { ok: true, status: 200, json: async () => ({}) } as Response
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const firstSheet = () => screen.getAllByRole('article')[0]
const show = (response: SolveResponse = solved) =>
  render(<Results response={response} wall={wall} onStartOver={vi.fn()} />)

describe('See it in 3D', () => {
  it('swaps the drawing for the 3D view inside the same card', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(firstSheet()).findByTestId('wall3d')).toBeInTheDocument()
    expect(within(firstSheet()).queryByRole('img', { name: /front elevation/i })).not.toBeInTheDocument()
    expect(within(firstSheet()).getByRole('button', { name: 'Back to the drawing' })).toBeInTheDocument()
  })

  it('follows the tier switch while open', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(firstSheet()).findByTestId('wall3d')

    await user.click(within(firstSheet()).getByRole('button', { name: /premiere/i }))

    expect(within(firstSheet()).getByTestId('wall3d').dataset.skus).toContain('MV-DB24')
  })

  it('closes when someone starts editing, because 3D is for looking', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(firstSheet()).findByTestId('wall3d')

    await user.click(within(firstSheet()).getByRole('button', { name: /edit this wall/i }))

    expect(within(firstSheet()).queryByTestId('wall3d')).not.toBeInTheDocument()
    expect(within(firstSheet()).getByRole('img', { name: /front elevation/i })).toBeInTheDocument()
  })

  it('is not offered without WebGL', () => {
    state.webgl = false
    show()
    expect(within(firstSheet()).queryByRole('button', { name: 'See it in 3D' })).not.toBeInTheDocument()
  })

  it('falls back to the drawing with a note if the 3D view fails', async () => {
    state.explode = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(firstSheet()).findByText('We couldn’t show this wall in 3D on this device.')).toBeInTheDocument()
    expect(within(firstSheet()).getByRole('img', { name: /front elevation/i })).toBeInTheDocument()
    expect(within(firstSheet()).queryByRole('button', { name: 'See it in 3D' })).not.toBeInTheDocument()
  })

  it('works on a shared design too', async () => {
    const user = userEvent.setup()
    const saved = solved.options[0].premiere
    show({ options: [{ label: 'Your saved wall', standard: saved, premiere: saved }], failure: null, notices: [] })

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect((await within(firstSheet()).findByTestId('wall3d')).dataset.skus).toContain('MV-DB24')
  })

  it('records opening 3D in the funnel', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(events).toContainEqual(expect.objectContaining({ name: 'view_3d_opened', properties: { rank: '0', tier: 'Standard' } }))
  })
})
