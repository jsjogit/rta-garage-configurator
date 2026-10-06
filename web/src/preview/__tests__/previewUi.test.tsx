import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'

// The shareable prototype: real layouts baked in, everything that needs a server visible but inactive.
vi.mock('../mode', async (actual) => ({ ...(await actual<typeof import('../mode')>()), PREVIEW: true }))
const solved = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('../load', () => ({
  ready: async () => undefined,
  previewSolve: async (input: unknown) => {
    solved.calls.push(input)
    return (await import('../../fixtures/vignette-72.json')).default
  },
}))

import { App } from '../../App'
import { Results } from '../../components/Results'

const fetchSpy = vi.fn()
beforeEach(() => {
  solved.calls = []
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
  window.history.replaceState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

const NOT_ACTIVE = /not active in this version of the prototype/i

describe('prototype preview', () => {
  it('shows the obstructions section greyed out and unusable, with a visual-only note', () => {
    render(<App />)
    const group = screen.getByRole('group', { name: /things on the wall/i })
    for (const button of within(group).getAllByRole('button')) expect(button).toBeDisabled()
    const section = group.closest('.field') as HTMLElement
    expect(section).toHaveClass('is-inactive')
    expect(within(section).getByText(/visual only/i)).toBeInTheDocument()
    expect(within(section).getByText(NOT_ACTIVE)).toBeInTheDocument()
  })

  it('snaps a typed wall to the baked grid and says so', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('spinbutton', { name: /wall length/i }), '245')
    expect(screen.getByText(/rounds to the nearest 6/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /workbench/i }))

    await waitFor(() => expect(solved.calls).toHaveLength(1))
    expect(solved.calls[0]).toMatchObject({ wall: { length: 246, ceiling: 96, obstructions: [] }, goal: 'Workbench' })
    expect(screen.getByRole('spinbutton', { name: /wall length/i })).toHaveValue(246)
  })

  it('never calls the network, not even for funnel events', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('spinbutton', { name: /wall length/i }), '72')
    await user.click(screen.getByRole('button', { name: /workbench/i }))
    await screen.findAllByRole('article')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('keeps editing, add to cart, sharing, email and designer visible but inactive', () => {
    render(<Results response={vignette as SolveResponse} wall={{ length: 72, ceiling: 96 }} onStartOver={vi.fn()} />)
    const sheet = screen.getAllByRole('article')[0]
    expect(within(sheet).getByRole('button', { name: /add all to cart/i })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: /edit this wall/i })).toBeDisabled()
    expect(within(sheet).getAllByText(NOT_ACTIVE).length).toBeGreaterThan(0)
  })

  it('keeps the share bar visible but inactive', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('spinbutton', { name: /wall length/i }), '72')
    await user.click(screen.getByRole('button', { name: /workbench/i }))
    await screen.findAllByRole('article')
    for (const name of [/save & copy link/i, /email me this/i, /have a designer/i]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    const bar = screen.getByRole('button', { name: /email me this/i }).closest('section') as HTMLElement
    expect(within(bar).getByText(NOT_ACTIVE)).toBeInTheDocument()
  })

})
