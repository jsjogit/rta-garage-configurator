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

  it('offers three goals; "Hide the mess" is gone', () => {
    // Joshua: Hide the mess and Max storage drew nearly the same wall.
    render(<Harness />)

    const goals = within(screen.getByRole('group', { name: /^goal$/i })).getAllByRole('button')

    expect(goals.map((b) => b.querySelector('strong')?.textContent)).toEqual(['Workbench', 'Max storage', 'A bit of both'])
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

  it('adds an obstruction at a typical size and place', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /two-car back wall/i }))
    await user.click(screen.getByRole('button', { name: /add electrical panel/i }))

    expect(wallState().obstructions).toEqual([
      { type: 'ElectricalPanel', startX: 180, width: 16, height: 30, bottomY: 48 },
    ])
  })

  it('takes the measured distance from the left corner and the width', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '186')
    await user.click(screen.getByRole('button', { name: /add window/i }))

    await user.clear(screen.getByLabelText(/window from left corner/i))
    await user.type(screen.getByLabelText(/window from left corner/i), '20')
    await user.clear(screen.getByLabelText(/window width/i))
    await user.type(screen.getByLabelText(/window width/i), '48')

    expect(wallState().obstructions[0]).toMatchObject({ type: 'Window', startX: 20, width: 48 })
  })

  it('asks how high a window or panel sits, but not a door or water heater', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '240')
    await user.click(screen.getByRole('button', { name: /add window/i }))
    await user.click(screen.getByRole('button', { name: /add side door/i }))

    await user.clear(screen.getByLabelText(/window off the floor/i))
    await user.type(screen.getByLabelText(/window off the floor/i), '44')
    await user.clear(screen.getByLabelText(/window height/i))
    await user.type(screen.getByLabelText(/window height/i), '30')

    expect(wallState().obstructions[0]).toMatchObject({ bottomY: 44, height: 30 })
    expect(screen.queryByLabelText(/side door off the floor/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/side door height/i)).not.toBeInTheDocument()
  })

  it('allows more than one of the same thing', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '360')
    await user.click(screen.getByRole('button', { name: /add window/i }))
    await user.click(screen.getByRole('button', { name: /add window/i }))

    expect(wallState().obstructions).toHaveLength(2)
    expect(screen.getByLabelText(/window 2 from left corner/i)).toBeInTheDocument()
  })

  it('removes an obstruction', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '240')
    await user.click(screen.getByRole('button', { name: /add water heater/i }))
    await user.click(screen.getByRole('button', { name: /remove water heater/i }))

    expect(wallState().obstructions).toEqual([])
  })

  it('will not add an obstruction before there is a wall to put it on', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: /add window/i })).toBeDisabled()
  })

  it('says when an obstruction runs past the end of the wall and holds the layouts back', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '120')
    await user.click(screen.getByRole('button', { name: /add window/i }))
    await user.clear(screen.getByLabelText(/window from left corner/i))
    await user.type(screen.getByLabelText(/window from left corner/i), '100')

    expect(screen.getByText(/runs past the end of the wall/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /max storage/i })).toBeDisabled()
  })

  it('says when a window would go through the ceiling', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/wall length in inches/i), '120')
    await user.click(screen.getByRole('button', { name: /add window/i }))
    await user.clear(screen.getByLabelText(/window off the floor/i))
    await user.type(screen.getByLabelText(/window off the floor/i), '90')

    expect(screen.getByText(/above the ceiling/i)).toBeInTheDocument()
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

  it('offers three different wall lengths as quick picks', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const lengths: number[] = []

    for (const name of [/single-car back wall/i, /two-car back wall/i, /three-car back wall/i]) {
      await user.click(screen.getByRole('button', { name }))
      lengths.push(wallState().length)
    }

    expect(lengths).toEqual([144, 240, 360])
  })

  it('lights only the quick pick that was chosen', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /two-car back wall/i }))

    expect(screen.getByRole('button', { name: /two-car back wall/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /single-car back wall/i })).toHaveAttribute('aria-pressed', 'false')
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
