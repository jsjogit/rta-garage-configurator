import type { ObstructionDto } from '../api/types'
import { Elevation, formatInches } from './Elevation'

/**
 * The wall as it stands while someone is still describing it: empty, dimensioned, with whatever
 * obstructions they have tapped already. It gives the inputs something to answer back to.
 */
export function LivePreview({
  length,
  ceiling,
  obstructions,
  compact = false,
}: {
  length: number
  ceiling: number
  obstructions: ObstructionDto[]
  compact?: boolean
}) {
  return (
    <section className="stage is-preview">
      <div className="stage-head">
        <h2>Your wall</h2>
        <span className="meta">
          {formatInches(length)} × {formatInches(ceiling)} ceiling
        </span>
      </div>

      <div className="preview">
        <Elevation
          layout={{ items: [] }}
          wallLength={length}
          ceiling={ceiling}
          obstructions={obstructions}
          id="live-preview"
          compact={compact}
        />
      </div>

      <p className="preview-empty">
        {obstructions.length > 0
          ? 'We will leave the clearance each of these needs. Pick what the wall is for and we will fill it.'
          : 'Pick what the wall is for and we will fill it with cabinets.'}
      </p>
    </section>
  )
}
