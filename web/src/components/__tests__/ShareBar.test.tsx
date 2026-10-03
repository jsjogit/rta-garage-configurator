import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareBar } from '../ShareBar'
import type { LayoutDto } from '../../api/types'

const wall = { length: 72, ceiling: 96 }
const layout: LayoutDto = {
  items: [{ sku: 'MV-B24-F', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' }],
}

let calls: { url: string; body?: Record<string, unknown> }[] = []

function stub(options: { leadFails?: boolean } = {}) {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ url, body })

      if (url === '/api/design') {
        return { ok: true, status: 200, json: async () => ({ configId: '7K2MQ4' }) } as Response
      }

      if (url === '/api/lead' && options.leadFails) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ message: 'That email address doesn’t look right — check it and try again.' }),
        } as Response
      }

      return { ok: true, status: 200, json: async () => ({ received: true }) } as Response
    }),
  )
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } })
}

function show(configId: string | null = null, onSaved = vi.fn()) {
  return render(
    <ShareBar wall={wall} goal="Balanced" layout={layout} configId={configId} onSaved={onSaved} />,
  )
}

beforeEach(() => stub())
afterEach(() => vi.unstubAllGlobals())

describe('ShareBar', () => {
  it('saves the design the first time someone asks for a link', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    show(null, onSaved)

    await user.click(screen.getByRole('button', { name: /save & copy link/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('7K2MQ4'))
    expect(calls.filter((c) => c.url === '/api/design')).toHaveLength(1)
  })

  it('shows the share link once it has one', async () => {
    const user = userEvent.setup()
    show()

    await user.click(screen.getByRole('button', { name: /save & copy link/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('/garage/design/7K2MQ4'))
  })

  it('does not save the same design twice', async () => {
    const user = userEvent.setup()
    show('ABC123')

    await user.click(screen.getByRole('button', { name: /copy share link/i }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(calls.filter((c) => c.url === '/api/design')).toHaveLength(0)
  })

  it('emails the design to whoever asks for it', async () => {
    const user = userEvent.setup()
    show()

    await user.click(screen.getByRole('button', { name: /email me this/i }))
    await user.type(screen.getByLabelText(/where should we send it/i), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      const lead = calls.find((c) => c.url === '/api/lead')!
      expect(lead.body).toMatchObject({ kind: 'EmailMe', email: 'someone@example.com', configId: '7K2MQ4' })
    })
  })

  it('lets someone tell a designer what they actually want changed', async () => {
    const user = userEvent.setup()
    show()

    await user.click(screen.getByRole('button', { name: /have a designer tweak it/i }))
    await user.type(screen.getByLabelText(/how do we reach you/i), 'someone@example.com')
    await user.type(screen.getByLabelText(/what would you change/i), 'There is a window on the left.')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      const lead = calls.find((c) => c.url === '/api/lead')!
      expect(lead.body).toMatchObject({ kind: 'DesignerHelp', message: 'There is a window on the left.' })
    })
  })

  it('only asks for a message when a designer is involved', async () => {
    const user = userEvent.setup()
    show()

    await user.click(screen.getByRole('button', { name: /email me this/i }))

    expect(screen.queryByLabelText(/what would you change/i)).not.toBeInTheDocument()
  })

  it('passes the API’s complaint straight back to the customer', async () => {
    const user = userEvent.setup()
    stub({ leadFails: true })
    show()

    await user.click(screen.getByRole('button', { name: /email me this/i }))
    await user.type(screen.getByLabelText(/where should we send it/i), 'nope@nope')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/doesn’t look right/i))
  })
})
