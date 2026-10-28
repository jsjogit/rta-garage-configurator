// web/src/three/buildScene.ts
import type { LayoutDto, ObstructionDto, PlacedItemDto, WallDto } from '../api/types'
import { boxHeight, fronts, LEG, legPositions } from '../geometry/fronts'

/*
  The 3D wall as plain boxes, with no Three.js in sight, so it can be tested without a GPU. Inches
  throughout: x along the wall from the left corner, y up from the floor, z out from the wall face.
  Wall3D.tsx is the only file that turns these into meshes.
*/

export type MaterialKey = 'carcass' | 'front' | 'pull' | 'counter' | 'wall' | 'floor' | 'ghost' | 'leg'

/** An axis-aligned box. (x, y, z) is its min corner. */
export interface Box {
  material: MaterialKey
  /** Default 'box'. 'rounded' softens the edges; 'cylinder' uses w (= d) as its diameter. */
  shape?: 'box' | 'rounded' | 'cylinder'
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

const FRONT_THICKNESS = 0.75
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
  const lift = item.height - boxHeight(item) // the legs, or 0
  const { faces, pulls } = fronts(item, item.y + item.height, -1)
  const sleeve = LEG.height * LEG.sleeveShare

  return [
    { material: 'carcass', shape: 'rounded', x: item.x, y: item.y + lift, z: 0, w: item.width, h: boxHeight(item), d: carcassDepth },
    ...faces.map((f): Box => ({ material: 'front', shape: 'rounded', x: f.x, y: f.y - f.height, z: carcassDepth, w: f.width, h: f.height, d: FRONT_THICKNESS })),
    ...pulls.flatMap((p) => barPull(p, item.depth)),
    ...legPositions(item).flatMap((leg): Box[] => [
      // Foot on the floor, the wider sleeve above it (MV-B24-F render).
      { material: 'leg', shape: 'cylinder', x: leg.x - LEG.footDiameter / 2, y: item.y, z: leg.z - LEG.footDiameter / 2, w: LEG.footDiameter, h: LEG.height - sleeve, d: LEG.footDiameter },
      { material: 'leg', shape: 'cylinder', x: leg.x - LEG.sleeveDiameter / 2, y: item.y + LEG.height - sleeve, z: leg.z - LEG.sleeveDiameter / 2, w: LEG.sleeveDiameter, h: sleeve, d: LEG.sleeveDiameter },
    ]),
  ]
}

const POST = 0.4 // square post section, inches
const GRIP_STANDOFF = 1 // how far the grip stands off the door

/** A U-shaped square bar pull (MV-BP36570FB render): two posts into the door and a grip across them. */
function barPull(p: { x: number; y: number; width: number; height: number }, faceZ: number): Box[] {
  const bottom = p.y - p.height
  const vertical = p.height > p.width
  const posts: Box[] = vertical
    ? [
        { material: 'pull', x: p.x, y: p.y - POST, z: faceZ, w: p.width, h: POST, d: GRIP_STANDOFF },
        { material: 'pull', x: p.x, y: bottom, z: faceZ, w: p.width, h: POST, d: GRIP_STANDOFF },
      ]
    : [
        { material: 'pull', x: p.x, y: bottom, z: faceZ, w: POST, h: p.height, d: GRIP_STANDOFF },
        { material: 'pull', x: p.x + p.width - POST, y: bottom, z: faceZ, w: POST, h: p.height, d: GRIP_STANDOFF },
      ]
  const grip: Box = { material: 'pull', x: p.x, y: bottom, z: faceZ + GRIP_STANDOFF, w: p.width, h: p.height, d: POST }
  return [...posts, grip]
}

export interface CameraFrame {
  position: [number, number, number]
  target: [number, number, number]
  distance: number
}

const FRAME_MARGIN = 1.12
const CABINET_REACH = 26 // the counter front, and the bar pulls on the bases just past it

/**
 * Where to put a camera with this vertical field of view and aspect ratio so the whole wall, floor
 * to ceiling and corner to corner, fits — then optionally swing it round the wall's centre, backing
 * off until the near end of the cabinets is still in the picture.
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
  const at = (d: number): [number, number, number] => [
    target[0] + d * Math.cos(el) * Math.sin(az),
    target[1] + d * Math.sin(el),
    target[2] + d * Math.cos(el) * Math.cos(az),
  ]

  let d = distance
  while (!inPicture(wall, at(d), target, halfH, halfV)) d *= 1.04
  return { target, distance: d, position: at(d) }
}

/** Do all eight corners of the cabinet volume project inside the camera's view? */
function inPicture(
  wall: WallDto,
  position: [number, number, number],
  target: [number, number, number],
  tanH: number,
  tanV: number,
): boolean {
  const unit = (v: number[]) => v.map((x) => x / Math.hypot(...v))
  const forward = unit(target.map((t, i) => t - position[i]))
  const right = unit([-forward[2], 0, forward[0]]) // forward × world up
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ]
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

  for (const x of [0, wall.length]) {
    for (const y of [0, wall.ceiling]) {
      for (const z of [0, CABINET_REACH]) {
        const v = [x - position[0], y - position[1], z - position[2]]
        const depth = dot(v, forward)
        if (Math.abs(dot(v, right) / depth) > tanH || Math.abs(dot(v, up) / depth) > tanV) return false
      }
    }
  }
  return true
}
