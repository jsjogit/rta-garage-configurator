// web/src/components/__tests__/ThreeD.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
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

const dialog = () => screen.getByRole('dialog')

describe('See it in 3D', () => {
  it('opens a large pop-up and leaves the drawing in the card', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(dialog()).findByTestId('wall3d')).toBeInTheDocument()
    expect(within(firstSheet()).getByRole('img', { name: /front elevation/i })).toBeInTheDocument()
    expect(within(dialog()).getByRole('heading', { name: /recommended/i })).toBeInTheDocument()
  })

  it('switches tier from inside the pop-up, and the card follows', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(dialog()).findByTestId('wall3d')

    await user.click(within(dialog()).getByRole('button', { name: /premiere/i }))

    expect(within(dialog()).getByTestId('wall3d').dataset.skus).toContain('MV-DB24')
    expect(within(firstSheet()).getByRole('button', { name: /premiere/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('closes from its close button and gives focus back to the button that opened it', async () => {
    const user = userEvent.setup()
    show()
    const opener = within(firstSheet()).getByRole('button', { name: 'See it in 3D' })
    await user.click(opener)
    await within(dialog()).findByTestId('wall3d')

    await user.click(within(dialog()).getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Focus goes back a frame later, once the modal has closed: nothing behind an open modal can take it.
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    show()
    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))
    await within(dialog()).findByTestId('wall3d')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('comes back with the edited wall once editing is done', async () => {
    // Found in the demo: after a change, the only way out of editing was to undo it, so 3D was gone.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const value =
          url === '/api/validate'
            ? { violations: [] }
            : url === '/api/price'
              ? { layout: body.layout, lineItems: [], subtotalList: 0, subtotalPromo: 0 }
              : { options: [] }
        return { ok: true, status: 200, json: async () => value } as Response
      }),
    )
    const user = userEvent.setup()
    show()
    const sheet = firstSheet()

    await user.click(within(sheet).getByRole('button', { name: /edit this wall/i }))
    expect(within(sheet).queryByRole('button', { name: /see it in 3d/i })).not.toBeInTheDocument()
    expect(within(sheet).getByText(/done editing to see your wall in 3d/i)).toBeInTheDocument()

    await user.click(within(sheet).getAllByRole('button', { name: /MV-W2430, 24 inches wide/i })[0])
    await user.click(within(sheet).getByRole('button', { name: /^remove$/i }))
    await user.click(within(sheet).getByRole('button', { name: /done editing/i }))
    await user.click(within(sheet).getByRole('button', { name: /see it in 3d/i }))

    const skus = (await within(dialog()).findByTestId('wall3d')).dataset.skus!.split(',')
    expect(skus.filter((sku) => sku === 'MV-W2430')).toHaveLength(1)
  })

  it('is not offered without WebGL', () => {
    state.webgl = false
    show()
    expect(within(firstSheet()).queryByRole('button', { name: 'See it in 3D' })).not.toBeInTheDocument()
  })

  it('closes with a note in the card if the 3D view fails', async () => {
    state.explode = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(await within(firstSheet()).findByText('We couldn’t show this wall in 3D on this device.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('works on a shared design, with no tier switch to fake', async () => {
    const user = userEvent.setup()
    const saved = solved.options[0].premiere
    show({ options: [{ label: 'Your saved wall', standard: saved, premiere: saved }], failure: null, notices: [] })

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect((await within(dialog()).findByTestId('wall3d')).dataset.skus).toContain('MV-DB24')
    expect(within(dialog()).queryByRole('group', { name: /cabinet tier/i })).not.toBeInTheDocument()
  })

  it('records the pop-up in the funnel', async () => {
    const user = userEvent.setup()
    show()

    await user.click(within(firstSheet()).getByRole('button', { name: 'See it in 3D' }))

    expect(events).toContainEqual(
      expect.objectContaining({ name: 'view_3d_opened', properties: { rank: '0', tier: 'Standard', surface: 'dialog' } }),
    )
  })
})
