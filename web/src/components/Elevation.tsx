import type { ObstructionDto, PlacedItemDto, LayoutDto } from '../api/types'

/*
  A true-proportion front elevation, drawn the way the shop would draw it: everything is in inches,
  the SVG viewBox does the scaling, and the 84" datum the solver enforces is drawn as a datum line
  so a customer can see why the tops line up.
*/

const PAD_X = 10
const PAD_TOP = 14
const PAD_BOTTOM = 30

const REVEAL = 0.75 // gap drawn between adjacent fronts
const PULL = { length: 0.45, thickness: 1.1 } // bar pull: fraction of face, inches thick

export interface ElevationProps {
  layout: LayoutDto
  wallLength: number
  ceiling: number
  obstructions?: ObstructionDto[]
  /** Stable prefix for pattern ids so snapshots do not churn. */
  id: string
  datumHeight?: number
}

export function Elevation({
  layout,
  wallLength,
  ceiling,
  obstructions = [],
  id,
  datumHeight = 84,
}: ElevationProps) {
  // SVG y runs down the page; the domain measures up from the floor.
  const toY = (up: number) => ceiling - up

  const floor = toY(0)
  const ordered = [...layout.items].sort((a, b) => zOrder(a) - zOrder(b))

  return (
    <svg
      className="elevation"
      viewBox={`${-PAD_X} ${-PAD_TOP} ${wallLength + PAD_X * 2} ${ceiling + PAD_TOP + PAD_BOTTOM}`}
      role="img"
      aria-label={describe(layout, wallLength, ceiling)}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={`${id}-hatch`} width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--slab-edge)" strokeWidth="1" />
        </pattern>
        <pattern id={`${id}-grain`} width="24" height="6" patternUnits="userSpaceOnUse">
          <rect width="24" height="6" fill="var(--wood)" />
          <line x1="0" y1="2" x2="24" y2="2" stroke="var(--wood-deep)" strokeWidth="0.4" opacity="0.5" />
          <line x1="0" y1="4.5" x2="24" y2="4.5" stroke="var(--wood-deep)" strokeWidth="0.3" opacity="0.35" />
        </pattern>
      </defs>

      {/* Garage shell: ceiling above, slab below. */}
      <line x1={0} y1={toY(ceiling)} x2={wallLength} y2={toY(ceiling)} stroke="var(--rule)" strokeWidth="0.8" />
      <line x1={-PAD_X / 2} y1={floor} x2={wallLength + PAD_X / 2} y2={floor} stroke="var(--ink)" strokeWidth="1.6" />

      {obstructions.map((o, i) => (
        <Ghost key={`o${i}`} obstruction={o} toY={toY} />
      ))}

      {/* The datum: wall-cabinet tops and pantry tops both land here. */}
      <line
        x1={-PAD_X / 2}
        y1={toY(datumHeight)}
        x2={wallLength + PAD_X / 2}
        y2={toY(datumHeight)}
        stroke="var(--graphite)"
        strokeWidth="0.5"
        strokeDasharray="6 3 1 3"
        opacity="0.75"
      />
      <text x={wallLength + PAD_X / 2} y={toY(datumHeight) - 2.5} textAnchor="end" className="elev-datum">
        {datumHeight}&#8243; datum
      </text>

      {ordered.map((item, i) => (
        <Item key={`${item.sku}-${item.x}-${item.y}-${i}`} item={item} toY={toY} id={id} />
      ))}

      <WidthDimension length={wallLength} y={floor + 14} />
    </svg>
  )
}

/** Counters draw over the boxes they sit on; knee spaces draw under everything. */
function zOrder(item: PlacedItemDto): number {
  if (item.zone === 'KneeSpace') return 0
  if (item.zone === 'Counter') return 2
  return 1
}

function Item({ item, toY, id }: { item: PlacedItemDto; toY: (up: number) => number; id: string }) {
  const y = toY(item.y + item.height)

  if (item.zone === 'KneeSpace') {
    return (
      <g>
        <rect x={item.x} y={y} width={item.width} height={item.height} fill="var(--concrete)" opacity="0.5" />
        <line x1={item.x} y1={y} x2={item.x} y2={y + item.height} stroke="var(--slab-edge)" strokeWidth="0.4" strokeDasharray="3 3" />
        <line x1={item.x + item.width} y1={y} x2={item.x + item.width} y2={y + item.height} stroke="var(--slab-edge)" strokeWidth="0.4" strokeDasharray="3 3" />
        <text x={item.x + item.width / 2} y={y + item.height / 2} textAnchor="middle" className="elev-knee">
          knee space
        </text>
      </g>
    )
  }

  if (item.zone === 'Counter') {
    return (
      <rect
        x={item.x}
        y={y}
        width={item.width}
        height={item.height}
        fill={`url(#${id}-grain)`}
        stroke="var(--wood-deep)"
        strokeWidth="0.5"
      />
    )
  }

  if (item.zone === 'Filler') {
    return (
      <rect
        x={item.x}
        y={y}
        width={item.width}
        height={item.height}
        fill={`url(#${id}-hatch)`}
        stroke="var(--slab-edge)"
        strokeWidth="0.5"
      />
    )
  }

  return (
    <g>
      <rect x={item.x} y={y} width={item.width} height={item.height} fill="var(--slab)" stroke="var(--slab-edge)" strokeWidth="0.5" />
      <Fronts item={item} top={y} />
    </g>
  )
}

/** Slab fronts with matte black bar pulls, laid out the way the box is actually built. */
function Fronts({ item, top }: { item: PlacedItemDto; top: number }) {
  const drawers = drawerCount(item.sku)

  if (drawers > 0) {
    const each = (item.height - REVEAL * (drawers + 1)) / drawers

    return (
      <>
        {Array.from({ length: drawers }, (_, i) => {
          const y = top + REVEAL + i * (each + REVEAL)
          return (
            <g key={i}>
              <rect x={item.x + REVEAL} y={y} width={item.width - REVEAL * 2} height={each} fill="var(--slab)" stroke="var(--slab-edge)" strokeWidth="0.3" />
              <rect
                x={item.x + item.width / 2 - (item.width * PULL.length) / 2}
                y={y + each / 2 - PULL.thickness / 2}
                width={item.width * PULL.length}
                height={PULL.thickness}
                fill="var(--ink)"
              />
            </g>
          )
        })}
      </>
    )
  }

  // A pair of doors above 24", otherwise a single door. Pulls sit at the opening edge.
  const pair = item.width >= 24
  const faceWidth = pair ? (item.width - REVEAL * 3) / 2 : item.width - REVEAL * 2
  const faceHeight = item.height - REVEAL * 2
  const pullHeight = Math.min(faceHeight * 0.4, 10)

  return (
    <>
      {Array.from({ length: pair ? 2 : 1 }, (_, i) => {
        const x = item.x + REVEAL + i * (faceWidth + REVEAL)
        // Pull goes on the inner edge for a pair, the right edge for a single door.
        const pullX = pair
          ? i === 0
            ? x + faceWidth - 2.2
            : x + 1.1
          : x + faceWidth - 2.2

        return (
          <g key={i}>
            <rect x={x} y={top + REVEAL} width={faceWidth} height={faceHeight} fill="var(--slab)" stroke="var(--slab-edge)" strokeWidth="0.3" />
            <rect x={pullX} y={top + item.height / 2 - pullHeight / 2} width={PULL.thickness} height={pullHeight} fill="var(--ink)" />
          </g>
        )
      })}
    </>
  )
}

function drawerCount(sku: string): number {
  if (sku.includes('-DB') || sku.startsWith('MV-DB')) {
    const match = sku.match(/-(\d)$/)
    return match ? Number(match[1]) : 3
  }
  return sku.includes('BWB') ? 1 : 0
}

/** Short names, because the label has to sit inside a 16" panel without running over the cabinets. */
const OBSTRUCTION_LABELS: Record<string, string> = {
  ElectricalPanel: 'panel',
  WaterHeater: 'heater',
  Window: 'window',
  SideDoor: 'door',
  GarageDoorTrack: 'track',
  Outlet: 'outlet',
}

const NOTE_SIZE = 5
const MONO_ADVANCE = 0.62 // of the font size, for IBM Plex Mono

function Ghost({ obstruction, toY }: { obstruction: ObstructionDto; toY: (up: number) => number }) {
  const y = toY(obstruction.bottomY + obstruction.height)
  const label = OBSTRUCTION_LABELS[obstruction.type] ?? spaceOut(obstruction.type)
  const labelWidth = label.length * NOTE_SIZE * MONO_ADVANCE

  return (
    <g opacity="0.55">
      <rect
        x={obstruction.startX}
        y={y}
        width={obstruction.width}
        height={obstruction.height}
        fill="none"
        stroke="var(--graphite)"
        strokeWidth="0.6"
        strokeDasharray="4 3"
      />
      {/* Drop the label rather than let it run across the cabinets either side; the dashed ghost and
          the SVG's aria-label still say what is there. */}
      {labelWidth <= obstruction.width * 1.4 && (
        <text x={obstruction.startX + obstruction.width / 2} y={y - 2} textAnchor="middle" className="elev-note">
          {label}
        </text>
      )}
    </g>
  )
}

function WidthDimension({ length, y }: { length: number; y: number }) {
  return (
    <g className="elev-dim">
      <line x1={0} y1={y} x2={length} y2={y} stroke="var(--graphite)" strokeWidth="0.5" />
      <line x1={0} y1={y - 3} x2={0} y2={y + 3} stroke="var(--graphite)" strokeWidth="0.8" />
      <line x1={length} y1={y - 3} x2={length} y2={y + 3} stroke="var(--graphite)" strokeWidth="0.8" />
      <text x={length / 2} y={y - 3} textAnchor="middle" className="elev-dim-text">
        {formatInches(length)}
      </text>
    </g>
  )
}

export function formatInches(value: number): string {
  const feet = Math.floor(value / 12)
  const inches = value - feet * 12
  const rounded = Number.isInteger(inches) ? inches : Number(inches.toFixed(1))

  if (feet === 0) return `${rounded}″`
  return rounded === 0 ? `${feet}′` : `${feet}′ ${rounded}″`
}

function spaceOut(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function describe(layout: LayoutDto, wallLength: number, ceiling: number): string {
  const counted = new Map<string, number>()

  for (const item of layout.items) {
    if (item.zone === 'KneeSpace') continue
    counted.set(item.sku, (counted.get(item.sku) ?? 0) + 1)
  }

  const knees = layout.items.filter((i) => i.zone === 'KneeSpace').length
  const parts = [...counted.entries()].map(([sku, qty]) => `${qty} × ${sku}`)

  if (knees > 0) parts.push(`${knees} open knee space`)

  return `Front elevation of a ${formatInches(wallLength)} wall with a ${formatInches(
    ceiling,
  )} ceiling: ${parts.join(', ')}.`
}
