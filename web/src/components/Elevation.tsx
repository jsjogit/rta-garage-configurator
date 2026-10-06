import { useRef, useState } from 'react'
import type { ObstructionDto, PlacedItemDto, LayoutDto } from '../api/types'
import { reorder, stepsForDrag } from '../editor/reorder'
import { fronts } from '../geometry/fronts'

/*
  A true-proportion front elevation, drawn the way the shop would draw it: everything is in inches,
  the SVG viewBox does the scaling, and the 84" datum the solver enforces is drawn as a datum line
  so a customer can see why the tops line up.
*/

const PAD_X = 10
const PAD_TOP = 14
const PAD_BOTTOM = 30

/* Pinned to the top of a phone the drawing only gets ~92px, so the margins have to give way or the
   wall ends up a thumbnail inside a mostly empty box. Proportions stay true either way. */
const COMPACT_PAD = { x: 4, top: 4, bottom: 14 }


export interface ElevationProps {
  layout: LayoutDto
  wallLength: number
  ceiling: number
  obstructions?: ObstructionDto[]
  /** Stable prefix for pattern ids so snapshots do not churn. */
  id: string
  datumHeight?: number
  /** Trims the drawing margins for the pinned mobile strip. */
  compact?: boolean
  /** Index into layout.items, or null. Tapping a cabinet opens the side panel. */
  selected?: number | null
  onSelect?: (index: number | null) => void
  /** Edit mode only: a cabinet was dragged or arrowed `steps` places along its row. */
  onReorder?: (index: number, steps: number) => void
  /** Makes obstructions draggable along the wall. Called with the obstruction's index and new startX. */
  onMoveObstruction?: (index: number, startX: number) => void
}

export function Elevation({
  layout,
  wallLength,
  ceiling,
  obstructions = [],
  id,
  datumHeight = 84,
  compact = false,
  selected = null,
  onSelect,
  onMoveObstruction,
  onReorder,
}: ElevationProps) {
  const padX = compact ? COMPACT_PAD.x : PAD_X
  const padTop = compact ? COMPACT_PAD.top : PAD_TOP
  const padBottom = compact ? COMPACT_PAD.bottom : PAD_BOTTOM
  // SVG y runs down the page; the domain measures up from the floor.
  const toY = (up: number) => ceiling - up

  const floor = toY(0)
  // While a cabinet is being dragged, draw the row as it would be if dropped here; the dragged
  // cabinet itself follows the pointer. The real layout only changes when the parent applies the drop.
  const [drag, setDrag] = useState<{ index: number; dx: number } | null>(null)
  const shown = drag ? reorder(layout, drag.index, stepsForDrag(layout, drag.index, drag.dx)) : layout
  // Keep the original index so a tap maps back to the item the editor will change.
  const ordered = shown.items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => zOrder(a.item) - zOrder(b.item))

  return (
    <svg
      className="elevation"
      viewBox={`${-padX} ${-padTop} ${wallLength + padX * 2} ${ceiling + padTop + padBottom}`}
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
      <line x1={0} y1={toY(ceiling)} x2={wallLength} y2={toY(ceiling)} stroke="var(--color-rule)" strokeWidth="0.8" />
      <line x1={-padX / 2} y1={floor} x2={wallLength + padX / 2} y2={floor} stroke="var(--ink)" strokeWidth="1.6" />

      {obstructions.map((o, i) =>
        onMoveObstruction ? (
          <DraggableGhost
            key={`o${i}`}
            obstruction={o}
            toY={toY}
            wallLength={wallLength}
            onMove={(startX) => onMoveObstruction(i, startX)}
          />
        ) : (
          <Ghost key={`o${i}`} obstruction={o} toY={toY} />
        ),
      )}

      {/* The datum: wall-cabinet tops and pantry tops both land here. Pointless on an empty wall. */}
      {layout.items.length > 0 && (
      <>
      <line
        x1={-padX / 2}
        y1={toY(datumHeight)}
        x2={wallLength + padX / 2}
        y2={toY(datumHeight)}
        stroke="var(--color-muted)"
        strokeWidth="0.5"
        strokeDasharray="6 3 1 3"
        opacity="0.75"
      />
      <text x={wallLength + padX / 2} y={toY(datumHeight) - 2.5} textAnchor="end" className="elev-datum">
        {datumHeight}&#8243; datum
      </text>
      </>
      )}

      {ordered.map(({ item, index }) => (
        <Item
          key={`item-${index}`}
          item={item}
          toY={toY}
          id={id}
          index={index}
          selected={selected === index}
          onSelect={onSelect}
          onReorder={onReorder}
          stepsFor={(dx) => stepsForDrag(layout, index, dx)}
          offset={drag?.index === index ? layout.items[index].x + drag.dx - shown.items[index].x : 0}
          onDrag={(dx) => setDrag(dx === null ? null : { index, dx })}
        />
      ))}

      <WidthDimension length={wallLength} y={floor + (compact ? 7 : 14)} />
    </svg>
  )
}

/** Counters draw over the boxes they sit on; knee spaces draw under everything. */
function zOrder(item: PlacedItemDto): number {
  if (item.zone === 'KneeSpace') return 0
  if (item.zone === 'Counter') return 2
  return 1
}

const DRAG_THRESHOLD = 2 // inches; less than this is a tap

function Item({
  item,
  toY,
  id,
  index,
  selected,
  onSelect,
  onReorder,
  stepsFor,
  offset,
  onDrag,
}: {
  item: PlacedItemDto
  toY: (up: number) => number
  id: string
  index: number
  selected: boolean
  onSelect?: (index: number | null) => void
  onReorder?: (index: number, steps: number) => void
  stepsFor: (dx: number) => number
  /** How far to draw this item from where `item.x` puts it: non-zero only for the one being dragged. */
  offset: number
  /** The drag distance in inches as it happens, then null when it ends. */
  onDrag: (dx: number | null) => void
}) {
  const grab = useRef<{ start: number; dragged: boolean } | null>(null)
  const swallowClick = useRef(false)
  const y = toY(item.y + item.height)
  const body = <ItemBody item={item} toY={toY} id={id} />

  if (!onSelect) return body

  const svgOf = (target: EventTarget) => (target as SVGGElement).ownerSVGElement!

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${item.zone === 'KneeSpace' ? 'Open knee space' : item.sku}, ${item.width} inches wide`}
      aria-pressed={selected}
      className={onReorder ? 'elev-hit elev-movable' : 'elev-hit'}
      transform={offset ? `translate(${offset} 0)` : undefined}
      onPointerDown={(event) => {
        if (!onReorder) return
        // A touch drag gets no click to clear this, so every new press starts fresh.
        swallowClick.current = false
        grab.current = { start: wallX(svgOf(event.currentTarget), event.clientX), dragged: false }
        ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!grab.current) return
        const moved = wallX(svgOf(event.currentTarget), event.clientX) - grab.current.start
        if (Math.abs(moved) >= DRAG_THRESHOLD) grab.current.dragged = true
        if (grab.current.dragged) onDrag(moved)
      }}
      onPointerUp={(event) => {
        const drag = grab.current
        grab.current = null
        onDrag(null)
        if (!drag?.dragged || !onReorder) return
        swallowClick.current = true
        const steps = stepsFor(wallX(svgOf(event.currentTarget), event.clientX) - drag.start)
        if (steps !== 0) onReorder(index, steps)
      }}
      onPointerCancel={() => {
        grab.current = null
        onDrag(null)
      }}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false
          return
        }
        onSelect(selected ? null : index)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(selected ? null : index)
        } else if (onReorder && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
          event.preventDefault()
          onReorder(index, event.key === 'ArrowRight' ? 1 : -1)
        }
      }}
    >
      {body}
      <rect
        x={item.x}
        y={y}
        width={item.width}
        height={item.height}
        fill="transparent"
        stroke={selected ? 'var(--ink)' : 'transparent'}
        strokeWidth={selected ? 1.6 : 0}
      />
    </g>
  )
}

function ItemBody({ item, toY, id }: { item: PlacedItemDto; toY: (up: number) => number; id: string }) {
  const y = toY(item.y + item.height)

  if (item.zone === 'KneeSpace') {
    return (
      <g>
        <rect x={item.x} y={y} width={item.width} height={item.height} fill="#f4f6f8" />
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

/** Slab fronts with matte black bar pulls, from the shared description in geometry/fronts.ts. */
function Fronts({ item, top }: { item: PlacedItemDto; top: number }) {
  const { faces, pulls } = fronts(item, top)

  return (
    <>
      {faces.map((face, i) => (
        <g key={i}>
          <rect x={face.x} y={face.y} width={face.width} height={face.height} fill="var(--slab)" stroke="var(--slab-edge)" strokeWidth="0.3" />
          <rect x={pulls[i].x} y={pulls[i].y} width={pulls[i].width} height={pulls[i].height} fill="var(--ink)" />
        </g>
      ))}
    </>
  )
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
        stroke="var(--color-muted)"
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

/** Pointer position in wall inches. Browsers give us the SVG's own transform; jsdom only a box. */
function wallX(svg: SVGSVGElement, clientX: number): number {
  const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
  if (ctm && typeof svg.createSVGPoint === 'function') {
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = 0
    return point.matrixTransform(ctm.inverse()).x
  }

  // preserveAspectRatio="xMidYMid meet": uniform scale, centred in the box.
  const [vbX, , vbW, vbH] = svg.getAttribute('viewBox')!.split(' ').map(Number)
  const box = svg.getBoundingClientRect()
  const scale = Math.min(box.width / vbW, box.height / vbH)
  return vbX + (clientX - box.left - (box.width - vbW * scale) / 2) / scale
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * An obstruction the customer can slide along the wall: drag it, or focus it and use the arrow keys
 * (an inch a press, a foot with shift). Only the position along the wall moves; sizes are typed.
 */
function DraggableGhost({
  obstruction,
  toY,
  wallLength,
  onMove,
}: {
  obstruction: ObstructionDto
  toY: (up: number) => number
  wallLength: number
  onMove: (startX: number) => void
}) {
  const grab = useRef<number | null>(null)
  const max = Math.max(0, wallLength - obstruction.width)
  const label = OBSTRUCTION_LABELS[obstruction.type] ?? spaceOut(obstruction.type)
  const place = (startX: number) => onMove(clamp(Math.round(startX * 2) / 2, 0, max))

  return (
    <g
      className="elev-drag"
      role="slider"
      tabIndex={0}
      aria-label={`${label}, inches from the left corner. Drag or use the arrow keys to move it.`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={obstruction.startX}
      onPointerDown={(event) => {
        const svg = (event.currentTarget as SVGGElement).ownerSVGElement!
        grab.current = wallX(svg, event.clientX) - obstruction.startX
        ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (grab.current === null) return
        const svg = (event.currentTarget as SVGGElement).ownerSVGElement!
        place(wallX(svg, event.clientX) - grab.current)
      }}
      onPointerUp={() => (grab.current = null)}
      onPointerCancel={() => (grab.current = null)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 12 : 1
        if (event.key === 'ArrowRight') place(obstruction.startX + step)
        else if (event.key === 'ArrowLeft') place(obstruction.startX - step)
        else return
        event.preventDefault()
      }}
    >
      {/* A filled hit area: the dashed outline alone is too thin to grab. */}
      <rect
        x={obstruction.startX}
        y={toY(obstruction.bottomY + obstruction.height)}
        width={obstruction.width}
        height={obstruction.height}
        className="elev-drag-hit"
      />
      <Ghost obstruction={obstruction} toY={toY} />
    </g>
  )
}

function WidthDimension({ length, y }: { length: number; y: number }) {
  return (
    <g className="elev-dim">
      <line x1={0} y1={y} x2={length} y2={y} stroke="var(--color-muted)" strokeWidth="0.5" />
      <line x1={0} y1={y - 3} x2={0} y2={y + 3} stroke="var(--color-muted)" strokeWidth="0.8" />
      <line x1={length} y1={y - 3} x2={length} y2={y + 3} stroke="var(--color-muted)" strokeWidth="0.8" />
      <text x={length / 2} y={y - 3} textAnchor="middle" className="elev-dim-text">
        {formatInches(length)}
      </text>
    </g>
  )
}

/** Cabinets are quoted in inches in the trade: 34.5" reads better than 2' 10.5". */
export function inches(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}\u2033`
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
  if (layout.items.length === 0) {
    return `Front elevation of an empty ${formatInches(wallLength)} wall with a ${formatInches(ceiling)} ceiling.`
  }

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
