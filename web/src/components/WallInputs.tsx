import type { Goal, ObstructionDto, WallDto } from '../api/types'
import { formatInches } from './Elevation'
import { NOT_ACTIVE_NOTE, PREVIEW } from '../preview/mode'

/** Something on the wall, as the customer measured it. Inches from the left corner and the floor. */
export interface DraftObstruction extends ObstructionDto {
  id: number
}

export interface WallDraft {
  length: number
  ceiling: number
  obstructions: DraftObstruction[]
  goal: Goal | null
  /** Which quick pick is lit; cleared when someone types their own length. */
  preset: string | null
}

export const EMPTY_DRAFT: WallDraft = { length: 0, ceiling: 96, obstructions: [], goal: null, preset: null }

const WALL_PRESETS = [
  { label: 'Single-car back wall', inches: 144 },
  { label: 'Two-car back wall', inches: 240 },
  { label: 'Three-car back wall', inches: 360 },
]

const CEILINGS = [
  { label: '8 ft', inches: 96 },
  { label: '9 ft', inches: 108 },
  { label: '10 ft', inches: 120 },
]

/*
  Typical sizes to start from; the customer then types what they measured or drags it in the drawing.
  Doors and water heaters stand on the floor and block the full height cabinets would use, so only
  windows and panels ask how high they sit.
*/
const OBSTRUCTIONS: {
  type: string
  label: string
  standsOnFloor: boolean
  make: (wallLength: number) => ObstructionDto
}[] = [
  {
    type: 'ElectricalPanel',
    label: 'Electrical panel',
    standsOnFloor: false,
    make: (w) => ({ type: 'ElectricalPanel', startX: Math.max(0, w * 0.75), width: 16, height: 30, bottomY: 48 }),
  },
  {
    type: 'WaterHeater',
    label: 'Water heater',
    standsOnFloor: true,
    make: () => ({ type: 'WaterHeater', startX: 0, width: 30, height: 72, bottomY: 0 }),
  },
  {
    type: 'Window',
    label: 'Window',
    standsOnFloor: false,
    make: (w) => ({ type: 'Window', startX: Math.max(0, w / 2 - 18), width: 36, height: 24, bottomY: 40 }),
  },
  {
    type: 'SideDoor',
    label: 'Side door',
    standsOnFloor: true,
    make: (w) => ({ type: 'SideDoor', startX: Math.max(0, w - 42), width: 38, height: 84, bottomY: 0 }),
  },
]

const kindOf = (type: string) => OBSTRUCTIONS.find((o) => o.type === type)

/** "Window", or "Window 2" when there is more than one, so every field has its own name. */
function nameOf(obstruction: DraftObstruction, all: DraftObstruction[]): string {
  const label = kindOf(obstruction.type)?.label ?? obstruction.type
  const same = all.filter((o) => o.type === obstruction.type)
  return same.length > 1 ? `${label} ${same.indexOf(obstruction) + 1}` : label
}

/** What is wrong with an obstruction as entered, in the customer's terms, or null. */
export function obstructionProblem(o: ObstructionDto, length: number, ceiling: number): string | null {
  if (!(o.width > 0)) return 'Give it a width.'
  if (o.startX < 0) return 'Measure from the left corner — this cannot be negative.'
  if (o.startX + o.width > length) return `This runs past the end of the wall (${formatInches(length)}).`
  if (o.bottomY < 0 || !(o.height > 0)) return 'Give it a height.'
  if (o.bottomY + o.height > ceiling) return 'This goes above the ceiling — check the height.'
  return null
}

const GOALS: { value: Goal; name: string; blurb: string }[] = [
  { value: 'Workbench', name: 'Workbench', blurb: 'Counter to work on, drawers where you stand.' },
  { value: 'Storage', name: 'Max storage', blurb: 'Tall cabinets, as much enclosed space as fits.' },
  { value: 'HideTheMess', name: 'Hide the mess', blurb: 'Doors front to back. Nothing on show.' },
  { value: 'Balanced', name: 'A bit of both', blurb: 'A bench in the middle, storage either side.' },
]

export function obstructionsFor(draft: WallDraft): ObstructionDto[] {
  return draft.obstructions.map(({ id: _id, ...o }) => o)
}

/** The inputs that would produce a saved wall, so a shared design opens with its own wall filled in. */
export function draftFor(wall: WallDto, goal: Goal): WallDraft {
  return {
    length: wall.length,
    ceiling: wall.ceiling,
    obstructions: (wall.obstructions ?? []).map((o, i) => ({ ...o, id: i + 1 })),
    goal,
    preset: null,
  }
}

export function wallFor(draft: WallDraft): WallDto {
  return { length: draft.length, ceiling: draft.ceiling, obstructions: obstructionsFor(draft) }
}

/** All three inputs on one screen. Choosing a goal is what asks for layouts. */
export function WallInputs({
  draft,
  onChange,
  onSolve,
  busy,
}: {
  draft: WallDraft
  onChange: (draft: WallDraft) => void
  onSolve: (goal: Goal) => void
  busy: boolean
}) {
  const set = (patch: Partial<WallDraft>) => onChange({ ...draft, ...patch })
  const problems = draft.obstructions.map((o) => obstructionProblem(o, draft.length, draft.ceiling))
  const firstProblem = draft.obstructions.find((_, i) => problems[i] !== null)
  const ready = draft.length > 0 && draft.ceiling > 0 && !firstProblem

  const add = (kind: (typeof OBSTRUCTIONS)[number]) => {
    const id = Math.max(0, ...draft.obstructions.map((o) => o.id)) + 1
    set({ obstructions: [...draft.obstructions, { ...kind.make(draft.length), id }] })
  }
  const update = (id: number, patch: Partial<ObstructionDto>) =>
    set({ obstructions: draft.obstructions.map((o) => (o.id === id ? { ...o, ...patch } : o)) })
  const remove = (id: number) => set({ obstructions: draft.obstructions.filter((o) => o.id !== id) })

  return (
    <section className="inputs" aria-label="Your wall">
      <div className="field">
        <h3>How big is the wall?</h3>
        <p className="hint">Measure corner to corner. Between sizes? Round down.</p>

        <div className="chips" role="group" aria-label="Common walls">
          {WALL_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.label}
              className="chip"
              aria-pressed={draft.preset === preset.label}
              onClick={() => set({ length: preset.inches, preset: preset.label })}
            >
              {preset.label} · {formatInches(preset.inches)}
            </button>
          ))}
        </div>

        <div className="measure">
          <label htmlFor="wall-length" className="visually-hidden">
            Wall length
          </label>
          <input
            id="wall-length"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="240"
            value={draft.length || ''}
            onChange={(e) => set({ length: Number(e.target.value), preset: null })}
            aria-label="Wall length in inches"
          />
          <span className="unit">inches</span>
          {draft.length > 0 && <span className="feet">{formatInches(draft.length)}</span>}
        </div>
        {PREVIEW && (
          <p className="hint">
            In this prototype, lengths from 6′ to 30′ work, and a typed length rounds to the nearest 6″.
          </p>
        )}
      </div>

      <div className="field">
        <h3>Ceiling height</h3>
        <p className="hint">This changes what we can fit, so we ask rather than guess.</p>
        <div className="chips" role="group" aria-label="Ceiling height">
          {CEILINGS.map((option) => (
            <button
              type="button"
              key={option.label}
              className="chip"
              aria-pressed={draft.ceiling === option.inches}
              onClick={() => set({ ceiling: option.inches })}
            >
              {option.label}
            </button>
          ))}
          <input
            type="number"
            min={1}
            className="chip"
            style={{ width: '6.5rem' }}
            value={draft.ceiling || ''}
            onChange={(e) => set({ ceiling: Number(e.target.value) })}
            aria-label="Ceiling height in inches"
          />
        </div>
      </div>

      <div className={PREVIEW ? 'field is-inactive' : 'field'} aria-disabled={PREVIEW || undefined}>
        <h3>Anything in the way?</h3>
        {PREVIEW && (
          <p className="inactive-note">
            Visual only. {NOT_ACTIVE_NOTE}
          </p>
        )}
        <p className="hint">
          Add what is on this wall, then measure from the left corner to its nearest edge. You can also drag
          it along the drawing.
        </p>
        <div className="chips" role="group" aria-label="Things on the wall">
          {OBSTRUCTIONS.map((kind) => (
            <button
              type="button"
              key={kind.type}
              className="chip"
              aria-label={`Add ${kind.label.toLowerCase()}`}
              disabled={PREVIEW || draft.length <= 0}
              onClick={() => add(kind)}
            >
              + {kind.label}
            </button>
          ))}
        </div>

        {draft.obstructions.length > 0 && (
          <ul className="obstructions">
            {draft.obstructions.map((o, i) => {
              const name = nameOf(o, draft.obstructions)
              const floorStanding = kindOf(o.type)?.standsOnFloor ?? false
              const field = (key: 'startX' | 'width' | 'bottomY' | 'height', label: string) => (
                <label className="measure-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    value={Number.isFinite(o[key]) ? o[key] : ''}
                    onChange={(e) => update(o.id, { [key]: e.target.value === '' ? NaN : Number(e.target.value) })}
                    aria-label={`${name} ${label.toLowerCase()}, inches`}
                  />
                </label>
              )

              return (
                <li key={o.id} className="obstruction">
                  <div className="obstruction-head">
                    <strong>{name}</strong>
                    <button type="button" className="linklike" onClick={() => remove(o.id)} aria-label={`Remove ${name.toLowerCase()}`}>
                      Remove
                    </button>
                  </div>
                  <div className="obstruction-fields">
                    {field('startX', 'From left corner')}
                    {field('width', 'Width')}
                    {!floorStanding && field('bottomY', 'Off the floor')}
                    {!floorStanding && field('height', 'Height')}
                  </div>
                  {problems[i] && (
                    <p className="field-error" role="alert">
                      {problems[i]}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="field">
        <h3>What is this wall for?</h3>
        <p className="hint">Pick one and we will draw it. You can try the others after.</p>
        <div className="goals" role="group" aria-label="Goal">
          {GOALS.map((option) => (
            <button
              type="button"
              key={option.value}
              className="goal"
              aria-pressed={draft.goal === option.value}
              disabled={!ready || busy}
              onClick={() => {
                set({ goal: option.value })
                onSolve(option.value)
              }}
            >
              <strong>{option.name}</strong>
              <span>{option.blurb}</span>
            </button>
          ))}
        </div>
        {draft.length <= 0 && <p className="hint">Add a wall length first.</p>}
        {firstProblem && (
          <p className="hint">Fix the {nameOf(firstProblem, draft.obstructions).toLowerCase()} measurements first.</p>
        )}
        {busy && <p className="hint">Working it out…</p>}
      </div>
    </section>
  )
}
