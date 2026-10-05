// web/src/three/buildScene.ts
import type { LayoutDto, ObstructionDto, PlacedItemDto, WallDto } from '../api/types'
import { fronts } from '../geometry/fronts'

/*
  The 3D wall as plain boxes, with no Three.js in sight, so it can be tested without a GPU. Inches
  throughout: x along the wall from the left corner, y up from the floor, z out from the wall face.
  Wall3D.tsx is the only file that turns these into meshes.
*/

export type MaterialKey = 'carcass' | 'front' | 'pull' | 'counter' | 'wall' | 'floor' | 'ghost'

/** An axis-aligned box. (x, y, z) is its min corner. */
export interface Box {
  material: MaterialKey
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

const FRONT_THICKNESS = 0.75
const PULL_PROUD = 1 // how far a bar pull stands off its front
const ROOM_MARGIN = 24 // wall and floor run a little past the cabinets either side
const FLOOR_DEPTH = 60
const GHOST_DEPTH: Record<string, number> = { WaterHeater: 22 }

export function buildScene(layout: LayoutDto, wall: WallDto): Box[] {
  const span = wall.length + ROOM_MARGIN * 2
  const boxes: Box[] = [
    { material: 'wall', x: -ROOM_MARGIN, y: 0, z: -1, w: span, h: wall.ceiling, d: 1 },
    { material: 'floor', x: -ROOM_MARGIN, y: -1, z: -1, w: span, h: 1, d: FLOOR_DEPTH },
  ]

  for (const obstruction of wall.obstructions ?? []) boxes.push(ghost(obstruction))
  for (const item of layout.items) boxes.push(...itemBoxes(item))
  return boxes
}

function ghost(o: ObstructionDto): Box {
  return { material: 'ghost', x: o.startX, y: o.bottomY, z: 0, w: o.width, h: o.height, d: GHOST_DEPTH[o.type] ?? 1 }
}

function itemBoxes(item: PlacedItemDto): Box[] {
  if (item.zone === 'KneeSpace') return []

  const whole = { x: item.x, y: item.y, z: 0, w: item.width, h: item.height, d: item.depth }
  if (item.zone === 'Counter') return [{ material: 'counter', ...whole }]
  if (item.zone === 'Filler') return [{ material: 'carcass', ...whole }]

  // The carcass stops short of the front so the slab faces sit flush with the cabinet's full depth.
  const carcassDepth = item.depth - FRONT_THICKNESS
  const { faces, pulls } = fronts(item, item.y + item.height, -1)

  return [
    { material: 'carcass', ...whole, d: carcassDepth },
    ...faces.map((f): Box => ({ material: 'front', x: f.x, y: f.y - f.height, z: carcassDepth, w: f.width, h: f.height, d: FRONT_THICKNESS })),
    ...pulls.map((p): Box => ({ material: 'pull', x: p.x, y: p.y - p.height, z: item.depth, w: p.width, h: p.height, d: PULL_PROUD })),
  ]
}

export interface CameraFrame {
  position: [number, number, number]
  target: [number, number, number]
  distance: number
}

const FRAME_MARGIN = 1.12

/**
 * Where to put a camera with this vertical field of view and aspect ratio so the whole wall, floor
 * to ceiling and corner to corner, fits — then optionally swing it round the wall's centre.
 */
export function frameCamera(
  wall: WallDto,
  fovDeg: number,
  aspect: number,
  angle: { azimuthDeg?: number; elevationDeg?: number } = {},
): CameraFrame {
  const halfV = Math.tan((fovDeg * Math.PI) / 360)
  const halfH = halfV * aspect
  const distance = Math.max(wall.ceiling / 2 / halfV, wall.length / 2 / halfH) * FRAME_MARGIN

  const target: [number, number, number] = [wall.length / 2, wall.ceiling / 2, 0]
  const az = ((angle.azimuthDeg ?? 0) * Math.PI) / 180
  const el = ((angle.elevationDeg ?? 0) * Math.PI) / 180

  return {
    target,
    distance,
    position: [
      target[0] + distance * Math.cos(el) * Math.sin(az),
      target[1] + distance * Math.sin(el),
      target[2] + distance * Math.cos(el) * Math.cos(az),
    ],
  }
}
