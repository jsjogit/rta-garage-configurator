import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Results } from '../Results'
import type { SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'
import { money } from '../Money'

const wall = { length: 72, ceiling: 96 }

interface Stubs {
  violations?: { code: string; message: string; sku: string | null }[]
  subtotal?: number
  cartReady?: boolean
  unmapped?: string[]
  storeOrigin?: string
}

let calls: { url: string; body?: unknown }[] = []

function stubFetch({ violations = [], subtotal = 1234, cartReady = true, unmapped = [], storeOrigin }: Stubs = {}) {
  calls = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ url, body })

      const json = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response

      if (url.startsWith('/api/swaps/')) {
        return json({
          sku: 'MV-B24-F',
          options: [
            { sku: 'MV-DB24-4', name: '4-Drawer Base Cabinet', zone: 'Base', width: 24, height: 34.5, depth: 24 },
            { sku: '', name: 'Open knee space', zone: 'KneeSpace', width: 24, height: 34.5, depth: 24 },
          ],
        })
      }

      if (url === '/api/validate') return json({ violations })

      if (url === '/api/price') {
        const layout = (body as { layout: { items: unknown[] } }).layout
        return json({
          layout,
          lineItems: [{ sku: 'MV-B24-F', quantity: 1, unitList: 683.1, unitPromo: 512.32, extendedList: 683.1, extendedPromo: 512.32 }],
          subtotalList: subtotal + 500,
          subtotalPromo: subtotal,
        })
      }

      if (url === '/api/cart') {
        return json({
          configId: null,
          lines: [{ sku: 'MV-B24-F', quantity: 2, productId: 101 }],
          ready: cartReady,
          unmappedSkus: unmapped,
          requests: cartReady ? [{ url: '/addproducttocart/catalog/101/1/2', method: 'POST' }] : [],
          cartUrl: 'https://www.rtacabinetstore.com/cart',
          // Tests run same-origin with the "store" so the posts are attempted.
          storeOrigin: storeOrigin ?? window.location.origin,
        })
      }

      return json({})
    }),
  )
}

function firstSheet() {
  return screen.getAllByRole('article')[0]
}

/** Editing is now opt-in: open the editor on a card, then tap a cabinet in its drawing. */
async function startEditing(user: ReturnType<typeof userEvent.setup>, sheet = firstSheet()) {
  await user.click(within(sheet).getByRole('button', { name: /edit this wall/i }))
  return sheet
}

async function selectFirstCabinet(user: ReturnType<typeof userEvent.setup>) {
  const sheet = await startEditing(user)
  await user.click(within(sheet).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0])
  return sheet
}

beforeEach(() => stubFetch())
afterEach(() => vi.unstubAllGlobals())

describe('editing a wall', () => {
  it('opens a panel when a cabinet is tapped', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)

    expect(within(sheet).getByRole('region', { name: /selected cabinet/i })).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'MV-B24-F' })).toBeInTheDocument()
    // Cabinets are quoted in inches, not feet and inches.
    expect(sheet).toHaveTextContent(/24\u2033 wide · 34.5\u2033 tall/)
  })

  it('names the knee space rather than showing an empty SKU', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    await startEditing(user)
    await user.click(within(firstSheet()).getByRole('button', { name: /open knee space, 24 inches wide/i }))

    expect(within(firstSheet()).getByRole('heading', { name: /open knee space/i })).toBeInTheDocument()
  })

  it('offers alternatives that fit the same hole', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)

    await waitFor(() => expect(within(sheet).getByRole('button', { name: /MV-DB24-4/ })).toBeInTheDocument())
  })

  it('re-validates and re-prices through the API after a swap', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)
    await waitFor(() => within(sheet).getByRole('button', { name: /MV-DB24-4/ }))
    await user.click(within(sheet).getByRole('button', { name: /MV-DB24-4/ }))

    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/validate')).toBe(true)
      expect(calls.some((c) => c.url === '/api/price')).toBe(true)
    })
  })

  it('shows the repriced total rather than the one it started with', async () => {
    const user = userEvent.setup()
    stubFetch({ subtotal: 999 })
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)
    await waitFor(() => within(sheet).getByRole('button', { name: /MV-DB24-4/ }))
    await user.click(within(sheet).getByRole('button', { name: /MV-DB24-4/ }))

    await waitFor(() => expect(sheet.querySelector('.parts-table tfoot')!.textContent).toContain('$999'))
  })

  it('shows what broke when an edit breaks a rule, in the customer’s words', async () => {
    const user = userEvent.setup()
    stubFetch({
      violations: [{ code: 'EndGapNeedsFiller', message: 'There is a 4" gap at the right end — close it with a filler strip.', sku: null }],
    })
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)
    await user.click(within(sheet).getByRole('button', { name: /^remove$/i }))

    await waitFor(() => expect(sheet).toHaveTextContent(/close it with a filler strip/i))
  })

  it('a cabinet cannot be tapped until the editor is open', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    expect(within(firstSheet()).queryByRole('button', { name: /MV-B24-F, 24 inches wide/i })).not.toBeInTheDocument()

    await startEditing(user)

    expect(within(firstSheet()).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0]).toBeInTheDocument()
  })

  it('will not let a broken wall go to the cart', async () => {
    const user = userEvent.setup()
    stubFetch({ violations: [{ code: 'ItemsOverlap', message: 'Two cabinets occupy the same space.', sku: null }] })
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)
    await user.click(within(sheet).getByRole('button', { name: /^remove$/i }))

    await waitFor(() => expect(within(sheet).getByRole('button', { name: /fix the wall first/i })).toBeDisabled())
  })

  it('can undo an edit and go back to the layout we suggested', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const sheet = await selectFirstCabinet(user)
    await user.click(within(sheet).getByRole('button', { name: /^remove$/i }))
    await waitFor(() => within(sheet).getByRole('button', { name: /undo my changes/i }))

    await user.click(within(sheet).getByRole('button', { name: /undo my changes/i }))

    expect(within(sheet).queryByRole('button', { name: /undo my changes/i })).not.toBeInTheDocument()
  })

  it('edits one sheet without touching the others', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    const [first, second] = screen.getAllByRole('article')
    const secondBefore = second.querySelector('.parts-table tfoot')!.textContent

    await startEditing(user, first)
    await user.click(within(first).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0])
    await user.click(within(first).getByRole('button', { name: /^remove$/i }))

    await waitFor(() => expect(first).toHaveTextContent(/edited/i))
    expect(second.querySelector('.parts-table tfoot')!.textContent).toBe(secondBefore)
  })
})

describe('adding to cart', () => {
  it('posts the add-to-cart requests the API hands back', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    await user.click(screen.getAllByRole('button', { name: /add all to cart/i })[0])

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/addproducttocart/catalog/101/1/2')).toBe(true),
    )
  })

  it('does not post add-to-cart from a page the store is not serving', async () => {
    // On a Static Web App the session cookie is not ours; posting would quietly 404.
    const user = userEvent.setup()
    stubFetch({ storeOrigin: 'https://www.rtacabinetstore.com' })
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    await user.click(screen.getAllByRole('button', { name: /add all to cart/i })[0])

    await waitFor(() => expect(calls.some((c) => c.url === '/api/cart')).toBe(true))
    expect(calls.some((c) => c.url.startsWith('/addproducttocart'))).toBe(false)
  })

  it('adds nothing and says so when the store cannot map every SKU', async () => {
    const user = userEvent.setup()
    stubFetch({ cartReady: false, unmapped: ['MV-CTHW7425'] })
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    await user.click(screen.getAllByRole('button', { name: /add all to cart/i })[0])

    await waitFor(() => expect(screen.getAllByRole('status')[0]).toHaveTextContent(/can’t add this wall automatically/i))
    expect(calls.some((c) => c.url.startsWith('/addproducttocart'))).toBe(false)
  })
})

const total = (sheet: HTMLElement) => sheet.querySelector('.parts-table tfoot .num')!.textContent

describe('switching tier', () => {
  it('shows the premiere price once the network settles', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = firstSheet()

    await user.click(within(sheet).getByRole('button', { name: /premiere/i }))

    // A stale reprice of the standard layout used to land here and overwrite the premiere total.
    await new Promise((resolve) => setTimeout(resolve, 20))
    const premiere = (vignette as SolveResponse).options[0].premiere.subtotalPromo
    expect(total(sheet)).toBe(money(premiere))
  })

  it('does not ask the API to reprice a layout nobody edited', async () => {
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)

    await user.click(within(firstSheet()).getByRole('button', { name: /premiere/i }))
    await user.click(within(firstSheet()).getByRole('button', { name: /standard/i }))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(calls.filter((c) => c.url === '/api/price' || c.url === '/api/validate')).toHaveLength(0)
  })
})

describe('undo', () => {
  it('a reprice still in flight cannot overwrite the undone wall', async () => {
    const user = userEvent.setup()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const real = fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/price' || url === '/api/validate') await gate
      return real(url, init)
    }))

    render(<Results response={vignette as SolveResponse} wall={wall} onStartOver={vi.fn()} />)
    const sheet = firstSheet()
    const original = total(sheet)

    await startEditing(user, sheet)
    await user.click(within(sheet).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0])
    await user.click(await within(sheet).findByRole('button', { name: /MV-DB24-4/i }))
    await user.click(await within(sheet).findByRole('button', { name: /undo my changes/i }))

    release()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(total(sheet)).toBe(original)
    expect(sheet.textContent).not.toMatch(/checking/i)
  })
})
