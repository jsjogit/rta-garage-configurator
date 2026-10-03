import type { Goal, ObstructionDto, WallDto } from '../api/types'
import { formatInches } from './Elevation'

export interface WallDraft {
  length: number
  ceiling: number
  obstructions: string[]
  goal: Goal | null
  /** Which quick pick is lit. Two presets share 20', so length alone cannot tell them apart. */
  preset: string | null
}

export const EMPTY_DRAFT: WallDraft = { length: 0, ceiling: 96, obstructions: [], goal: null, preset: null }

const WALL_PRESETS = [
  { label: 'Single-car side wall', inches: 240 },
  { label: 'Two-car back wall', inches: 240 },
  { label: 'Three-car back wall', inches: 360 },
]

const CEILINGS = [
  { label: '8 ft', inches: 96 },
  { label: '9 ft', inches: 108 },
  { label: '10 ft', inches: 120 },
]

/*
  Presets only, no fine positioning and no custom shapes: a wall that needs more than this is a
  conversation with a designer, not a bigger widget (docs/DECISIONS.md).
*/
const OBSTRUCTIONS: { label: string; make: (wallLength: number) => ObstructionDto }[] = [
  {
    label: 'Electrical panel',
    make: (w) => ({ type: 'ElectricalPanel', startX: Math.max(0, w * 0.75), width: 16, height: 30, bottomY: 48 }),
  },
  { label: 'Water heater', make: () => ({ type: 'WaterHeater', startX: 0, width: 30, height: 72, bottomY: 0 }) },
  {
    label: 'Window',
    make: (w) => ({ type: 'Window', startX: Math.max(0, w / 2 - 18), width: 36, height: 24, bottomY: 40 }),
  },
  {
    label: 'Side door',
    make: (w) => ({ type: 'SideDoor', startX: Math.max(0, w - 42), width: 38, height: 84, bottomY: 0 }),
  },
]

const GOALS: { value: Goal; name: string; blurb: string }[] = [
  { value: 'Workbench', name: 'Workbench', blurb: 'Counter to work on, drawers where you stand.' },
  { value: 'Storage', name: 'Max storage', blurb: 'Tall cabinets, as much enclosed space as fits.' },
  { value: 'HideTheMess', name: 'Hide the mess', blurb: 'Doors front to back. Nothing on show.' },
  { value: 'Balanced', name: 'A bit of both', blurb: 'A bench in the middle, storage either side.' },
]

export function obstructionsFor(draft: WallDraft): ObstructionDto[] {
  return OBSTRUCTIONS.filter((o) => draft.obstructions.includes(o.label)).map((o) => o.make(draft.length))
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
  const ready = draft.length > 0 && draft.ceiling > 0

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

      <div className="field">
        <h3>Anything in the way?</h3>
        <p className="hint">Tap what is on this wall. We leave the clearance each one needs.</p>
        <div className="chips" role="group" aria-label="Things on the wall">
          {OBSTRUCTIONS.map((option) => (
            <button
              type="button"
              key={option.label}
              className="chip"
              aria-pressed={draft.obstructions.includes(option.label)}
              onClick={() =>
                set({
                  obstructions: draft.obstructions.includes(option.label)
                    ? draft.obstructions.filter((l) => l !== option.label)
                    : [...draft.obstructions, option.label],
                })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
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
        {!ready && <p className="hint">Add a wall length first.</p>}
        {busy && <p className="hint">Working it out…</p>}
      </div>
    </section>
  )
}
