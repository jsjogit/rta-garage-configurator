import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { WallInputs, EMPTY_DRAFT, wallFor, type WallDraft } from '../WallInputs'

function Harness({ onSolve = vi.fn() }: { onSolve?: (goal: string) => void }) {
  const [draft, setDraft] = useState<WallDraft>(EMPTY_DRAFT)

  return (
    <>
      <WallInputs draft={draft} onChange={setDraft} onSolve={onSolve as never} busy={false} />
      <output data-testid="wall">{JSON.stringify(wallFor(draft))}</output>
    </>
  )
}

const wallState = () => JSON.parse(screen.getByTestId('wall').textContent!)

describe('WallInputs', () => {
  it('puts every input on one screen with no step indicator', () => {
    render(<Harness />)

    expect(screen.getByRole('group', { name: /common walls/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /things on the wall/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /^goal$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument()
  })

  it('asks for the ceiling rather than assuming one', () => {
    render(<Harness />)

    expect(screen.getByLabelText(/ceiling height in inches/i)).toHaveValue(96)
    expect(screen.getByText(/changes what we can fit/i)).toBeInTheDocument()
  })

  it('sets the wall length from a quick pick', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /three-car back wall/i }))

    expect(wallState().length).toBe(360)
  })

  it('turns an obstruction chip into a real obstruction on the wall', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /single-car side wall/i }))
    await user.click(screen.getByRole('button', { name: /electrical panel/i }))

    expect(wallState().obstructions).toEqual([
      { type: 'ElectricalPanel', startX: 180, width: 16, height: 30, bottomY: 48 },
    ])
  })

  it('offers only presets, never a free-form obstruction editor', () => {
    render(<Harness />)

    const group = screen.getByRole('group', { name: /things on the wall/i })
    expect(within(group).queryAllByRole('textbox')).toHaveLength(0)
    expect(within(group).queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('will not ask for layouts until there is a wall length', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: /max storage/i })).toBeDisabled()
    expect(screen.getByText(/add a wall length first/i)).toBeInTheDocument()
  })

  it('choosing a goal is what asks for layouts', async () => {
    const user = userEvent.setup()
    const onSolve = vi.fn()
    render(<Harness onSolve={onSolve} />)

    await user.click(screen.getByRole('button', { name: /two-car back wall/i }))
    await user.click(screen.getByRole('button', { name: /max storage/i }))

    expect(onSolve).toHaveBeenCalledWith('Storage')
  })

  it('lights only the quick pick that was chosen, even when two share a length', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /two-car back wall/i }))

    // Both presets are 20 feet; only the one tapped should read as selected.
    expect(screen.getByRole('button', { name: /two-car back wall/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /single-car side wall/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('typing a length clears the quick pick', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /three-car back wall/i }))
    await user.clear(screen.getByLabelText(/wall length in inches/i))
    await user.type(screen.getByLabelText(/wall length in inches/i), '200')

    expect(screen.getByRole('button', { name: /three-car back wall/i })).toHaveAttribute('aria-pressed', 'false')
    expect(wallState().length).toBe(200)
  })

  it('takes a measured length instead of a quick pick', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '138')

    expect(wallState().length).toBe(138)
  })
})
