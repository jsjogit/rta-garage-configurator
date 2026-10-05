import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import type { LayoutDto, SolveResponse } from '../api/types'
import vignette from '../fixtures/vignette-72.json'

// Whole-page tests for the wiring between the result sheets and the share bar. Found by driving
// the real app against the real API: the share bar saved the recommended standard wall no matter
// which wall, tier or edit the customer was looking at.

const solved = vignette as SolveResponse
const wall = { length: 72, ceiling: 96, obstructions: [] }

let calls: { url: string; body?: Record<string, unknown> }[] = []
let saves = 0

function stubFetch(saved?: { tier: 'Standard' | 'Premiere' }) {
  calls = []
  saves = 0

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ url, body })
      const json = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response

      if (url === '/api/solve') return json(solved)
      if (url === '/api/design') return json({ configId: `SAVED${++saves}` })
      if (url === '/api/validate') return json({ violations: [] })
      if (url === '/api/price') return json({ ...solved.options[0].standard, layout: (body as { layout: LayoutDto }).layout })
      if (url.startsWith('/api/design/') && saved) {
        const design = saved.tier === 'Premiere' ? solved.options[0].premiere : solved.options[0].standard
        return json({ configId: 'ABC123', wall, goal: 'Workbench', design, savedAtUtc: '2026-10-05T00:00:00Z' })
      }

      return json({})
    }),
  )
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => undefined) }, sendBeacon: () => true })
}

const savedLayouts = () => calls.filter((c) => c.url === '/api/design').map((c) => c.body!.layout as LayoutDto)

async function solveVignette(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.type(screen.getByRole('spinbutton', { name: /wall length/i }), '72')
  await user.click(screen.getByRole('button', { name: /workbench/i }))
  await screen.findAllByRole('article')
}

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  stubFetch()
})
afterEach(() => vi.unstubAllGlobals())

describe('sharing from the results', () => {
  it('saves the recommended wall when nothing else was touched', async () => {
    const user = userEvent.setup()
    await solveVignette(user)

    await user.click(screen.getByRole('button', { name: /save & copy link/i }))

    await waitFor(() => expect(savedLayouts()).toHaveLength(1))
    expect(savedLayouts()[0]).toEqual(solved.options[0].standard.layout)
  })

  it('saves the wall and tier the customer was last looking at', async () => {
    const user = userEvent.setup()
    await solveVignette(user)

    const second = screen.getAllByRole('article')[1]
    await user.click(within(second).getByRole('button', { name: /premiere/i }))
    await user.click(screen.getByRole('button', { name: /save & copy link/i }))

    await waitFor(() => expect(savedLayouts()).toHaveLength(1))
    expect(savedLayouts()[0]).toEqual(solved.options[1].premiere.layout)
  })

  it('says which wall it is about to save', async () => {
    const user = userEvent.setup()
    await solveVignette(user)

    await user.click(within(screen.getAllByRole('article')[1]).getByRole('button', { name: /premiere/i }))

    expect(screen.getByText(/saving: another option · premiere/i)).toBeInTheDocument()
  })

  it('saves again rather than reusing a code for a wall that has since changed', async () => {
    const user = userEvent.setup()
    await solveVignette(user)

    await user.click(screen.getByRole('button', { name: /save & copy link/i }))
    await waitFor(() => expect(savedLayouts()).toHaveLength(1))

    await user.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: /premiere/i }))
    await user.click(screen.getByRole('button', { name: /copy share link|save & copy link/i }))

    await waitFor(() => expect(savedLayouts()).toHaveLength(2))
    expect(savedLayouts()[1]).toEqual(solved.options[0].premiere.layout)
  })
})

describe('opening a shared design', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/garage/design/ABC123')
    stubFetch({ tier: 'Premiere' })
  })

  it('shows one saved wall, not three', async () => {
    render(<App />)
    await screen.findAllByRole('article')

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.queryByText(/three ways/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 of 3/)).not.toBeInTheDocument()
  })

  it('opens on the saved tier and offers no switch that would do nothing', async () => {
    render(<App />)
    const sheet = (await screen.findAllByRole('article'))[0]

    expect(within(sheet).queryByRole('group', { name: /cabinet tier/i })).not.toBeInTheDocument()
    expect(sheet).toHaveTextContent(/drawer banks/i)
  })

  it('fills the inputs in with the saved wall', async () => {
    render(<App />)
    await screen.findAllByRole('article')

    expect(screen.getByRole('spinbutton', { name: /wall length/i })).toHaveValue(72)
    expect(screen.getByRole('button', { name: /workbench/i })).toBeEnabled()
  })
})
