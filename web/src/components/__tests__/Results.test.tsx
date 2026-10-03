import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Results } from '../Results'
import type { SolveResponse } from '../../api/types'

import vignette from '../../fixtures/vignette-72.json'
import panel from '../../fixtures/two-car-panel.json'
import tipUp from '../../fixtures/tip-up-84.json'
import tooShort from '../../fixtures/too-short.json'

const wall = { length: 72, ceiling: 96 }

function show(response: SolveResponse, w = wall) {
  return render(<Results response={response} wall={w} onStartOver={vi.fn()} />)
}

describe('Results', () => {
  it('shows one sheet per option', () => {
    show(vignette as SolveResponse)
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it('marks the first sheet as the recommended one', () => {
    show(vignette as SolveResponse)
    expect(screen.getAllByRole('article')[0]).toHaveTextContent(/recommended/i)
  })

  it('prices every sheet', () => {
    show(vignette as SolveResponse)
    for (const sheet of screen.getAllByRole('article')) {
      expect(sheet.textContent).toMatch(/\$\d/)
    }
  })

  it('switching tier reprices that sheet without touching the others', async () => {
    const user = userEvent.setup()
    show(vignette as SolveResponse)

    const [first, second] = screen.getAllByRole('article')
    const before = first.querySelector('.title-block')!.textContent
    const secondBefore = second.querySelector('.title-block')!.textContent

    await user.click(within(first).getByRole('button', { name: /premiere/i }))

    expect(first.querySelector('.title-block')!.textContent).not.toBe(before)
    expect(second.querySelector('.title-block')!.textContent).toBe(secondBefore)
  })

  it('premiere costs more than standard', async () => {
    const user = userEvent.setup()
    show(vignette as SolveResponse)
    const sheet = screen.getAllByRole('article')[0]

    const price = () => Number(sheet.querySelector('.title-block .v')!.textContent!.replace(/[^0-9]/g, ''))
    const doors = price()

    await user.click(within(sheet).getByRole('button', { name: /premiere/i }))

    expect(price()).toBeGreaterThan(doors)
  })

  it('explains why pantries are missing instead of silently dropping them', () => {
    show(tipUp as SolveResponse, { length: 240, ceiling: 84 })

    const notice = screen.getByRole('complementary')
    expect(notice).toHaveTextContent(/assembled/i)
    expect(within(notice).getByRole('link', { name: /designer/i })).toBeInTheDocument()
  })

  it('offers a designer when the wall has something to work around', () => {
    show(panel as SolveResponse, { length: 240, ceiling: 96 })
    expect(screen.getByRole('complementary')).toHaveTextContent(/second opinion|keep clear/i)
  })

  it('does not nag about designers on a clean wall', () => {
    show(vignette as SolveResponse)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('says why a wall cannot be planned and offers a way forward', () => {
    show(tooShort as SolveResponse, { length: 12, ceiling: 96 })

    expect(screen.getByText(/too short for our smallest cabinet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change the measurements/i })).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('says what each tier actually changes, since the names do not', async () => {
    const user = userEvent.setup()
    show(vignette as SolveResponse)
    const sheet = screen.getAllByRole('article')[0]

    expect(sheet).toHaveTextContent(/full-height doors/i)

    await user.click(within(sheet).getByRole('button', { name: /premiere/i }))

    expect(sheet).toHaveTextContent(/drawer banks/i)
  })

  it('sends the cart button to the store cart', () => {
    show(vignette as SolveResponse)
    const links = screen.getAllByRole('link', { name: /add this wall to cart/i })
    expect(links[0]).toHaveAttribute('href', 'https://www.rtacabinetstore.com/cart')
  })
})
