import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Wizard } from '../Wizard'

async function walkToGoals(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /continue/i }))
  await user.click(screen.getByRole('button', { name: /continue/i }))
}

describe('Wizard', () => {
  it('asks for the ceiling rather than assuming one', () => {
    render(<Wizard onSolve={vi.fn()} busy={false} />)

    expect(screen.getByLabelText(/ceiling height in inches/i)).toHaveValue(96)
    expect(screen.getByText(/changes what we can fit/i)).toBeInTheDocument()
  })

  it('walks wall, obstructions, goal and then solves', async () => {
    const user = userEvent.setup()
    const onSolve = vi.fn()
    render(<Wizard onSolve={onSolve} busy={false} />)

    await user.click(screen.getByRole('button', { name: /three-car back wall/i }))
    await walkToGoals(user)
    await user.click(screen.getByRole('button', { name: /max storage/i }))
    await user.click(screen.getByRole('button', { name: /plan my wall/i }))

    expect(onSolve).toHaveBeenCalledWith({
      wall: { length: 360, ceiling: 96, obstructions: [] },
      goal: 'Storage',
    })
  })

  it('will not solve until a goal is chosen', async () => {
    const user = userEvent.setup()
    render(<Wizard onSolve={vi.fn()} busy={false} />)

    await walkToGoals(user)

    expect(screen.getByRole('button', { name: /plan my wall/i })).toBeDisabled()
  })

  it('turns an obstruction chip into a real obstruction on the wall', async () => {
    const user = userEvent.setup()
    const onSolve = vi.fn()
    render(<Wizard onSolve={onSolve} busy={false} />)

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /electrical panel/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /workbench/i }))
    await user.click(screen.getByRole('button', { name: /plan my wall/i }))

    const { wall } = onSolve.mock.calls[0][0]
    expect(wall.obstructions).toEqual([
      { type: 'ElectricalPanel', startX: 180, width: 16, height: 30, bottomY: 48 },
    ])
  })

  it('offers only presets, never a free-form obstruction editor', async () => {
    const user = userEvent.setup()
    render(<Wizard onSolve={vi.fn()} busy={false} />)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    const group = screen.getByRole('group', { name: /things on the wall/i })
    expect(within(group).queryAllByRole('textbox')).toHaveLength(0)
    expect(within(group).queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('lets someone go back and change the wall', async () => {
    const user = userEvent.setup()
    render(<Wizard onSolve={vi.fn()} busy={false} />)

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByLabelText(/^wall length$/i)).toBeInTheDocument()
  })

  it('says what it is doing while it works', () => {
    render(<Wizard onSolve={vi.fn()} busy />)
    expect(screen.queryByRole('button', { name: /working it out/i })).not.toBeInTheDocument()
  })
})
