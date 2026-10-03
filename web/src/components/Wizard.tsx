import { useState } from 'react'
import type { Goal, ObstructionDto, WallDto } from '../api/types'
import { formatInches } from './Elevation'

export interface WizardValue {
  wall: WallDto
  goal: Goal
}

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
  Obstruction entry is deliberately coarse — presets dropped on the wall, no fine positioning and no
  custom shapes. Anything beyond this is a conversation with a designer, not a widget.
*/
const OBSTRUCTIONS: { label: string; make: (wallLength: number) => ObstructionDto }[] = [
  {
    label: 'Electrical panel',
    make: (w) => ({ type: 'ElectricalPanel', startX: Math.max(0, w * 0.75), width: 16, height: 30, bottomY: 48 }),
  },
  {
    label: 'Water heater',
    make: () => ({ type: 'WaterHeater', startX: 0, width: 30, height: 72, bottomY: 0 }),
  },
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

export function Wizard({ onSolve, busy }: { onSolve: (value: WizardValue) => void; busy: boolean }) {
  const [step, setStep] = useState(0)
  const [length, setLength] = useState(240)
  const [ceiling, setCeiling] = useState(96)
  const [picked, setPicked] = useState<string[]>([])
  const [goal, setGoal] = useState<Goal | null>(null)

  const obstructions = OBSTRUCTIONS.filter((o) => picked.includes(o.label)).map((o) => o.make(length))
  const canContinue = step === 0 ? length > 0 && ceiling > 0 : step === 1 ? true : goal !== null

  const submit = () => {
    if (!goal) return
    onSolve({ wall: { length, ceiling, obstructions }, goal })
  }

  return (
    <section>
      <ol className="rail">
        {['1 Wall', '2 What’s in the way', '3 What it’s for'].map((label, i) => (
          <li key={label} data-state={i === step ? 'current' : i < step ? 'done' : 'todo'}>
            <span className="tick" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="panel">
          <h2>How big is the wall?</h2>
          <p className="hint">
            Measure corner to corner. If you are between sizes, round down — a short wall is easier to
            finish than a long one.
          </p>

          <span className="field-label" id="wall-presets">Common walls</span>
          <div className="chips" role="group" aria-labelledby="wall-presets">
            {WALL_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.label}
                className="chip"
                aria-pressed={length === preset.inches}
                onClick={() => setLength(preset.inches)}
              >
                {preset.label} · {formatInches(preset.inches)}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="wall-length">Wall length</label>
          <div className="measure">
            <input
              id="wall-length"
              type="number"
              min={1}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
            <span className="unit">inches</span>
            <span className="feet">{formatInches(length)}</span>
          </div>

          <span className="field-label" id="ceiling-label" style={{ marginTop: '1.25rem' }}>
            Ceiling height
          </span>
          <p className="hint">
            This one changes what we can fit, so we ask rather than guess. Look up — most garages are
            8&nbsp;ft.
          </p>
          <div className="chips" role="group" aria-labelledby="ceiling-label">
            {CEILINGS.map((option) => (
              <button
                type="button"
                key={option.label}
                className="chip"
                aria-pressed={ceiling === option.inches}
                onClick={() => setCeiling(option.inches)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="measure">
            <input
              id="ceiling-height"
              type="number"
              min={1}
              value={ceiling}
              onChange={(e) => setCeiling(Number(e.target.value))}
              aria-label="Ceiling height in inches"
            />
            <span className="unit">inches</span>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="panel">
          <h2>Anything in the way?</h2>
          <p className="hint">
            Tap whatever is on this wall. We will leave the clearance each one needs. Nothing to
            report? Skip ahead.
          </p>
          <div className="chips" role="group" aria-label="Things on the wall">
            {OBSTRUCTIONS.map((option) => (
              <button
                type="button"
                key={option.label}
                className="chip"
                aria-pressed={picked.includes(option.label)}
                onClick={() =>
                  setPicked((current) =>
                    current.includes(option.label)
                      ? current.filter((l) => l !== option.label)
                      : [...current, option.label],
                  )
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel">
          <h2>What is this wall for?</h2>
          <p className="hint">Pick the one that sounds most like you. You can try the others after.</p>
          <div className="goal-grid" role="group" aria-label="Goal">
            {GOALS.map((option) => (
              <button
                type="button"
                key={option.value}
                className="goal"
                aria-pressed={goal === option.value}
                onClick={() => setGoal(option.value)}
              >
                <strong>{option.name}</strong>
                <span>{option.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="actions">
        {step > 0 && (
          <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < 2 ? (
          <button type="button" className="btn" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button type="button" className="btn" disabled={!canContinue || busy} onClick={submit}>
            {busy ? 'Working it out…' : 'Plan my wall'}
          </button>
        )}
      </div>
    </section>
  )
}
