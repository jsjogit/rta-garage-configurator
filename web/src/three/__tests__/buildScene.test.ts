// web/src/three/__tests__/buildScene.test.ts
import { describe, expect, it } from 'vitest'
import { buildScene, frameCamera, type Box } from '../buildScene'
import type { LayoutDto, PlacedItemDto, SolveResponse, WallDto } from '../../api/types'
import vignetteJson from '../../fixtures/vignette-72.json'
import panelJson from '../../fixtures/two-car-panel.json'

const vignette = (vignetteJson as SolveResponse).options[0]
const panel = (panelJson as SolveResponse).options[0].standard.layout
const wall72: WallDto = { length: 72, ceiling: 96 }

const of = (boxes: Box[], material: Box['material']) => boxes.filter((b) => b.material === material)
const one = (item: PlacedItemDto) => buildScene({ items: [item] }, { length: 120, ceiling: 96 })

describe('buildScene', () => {
  it('draws a box for every cabinet and leaves the knee space open', () => {
    const boxes = buildScene(vignette.standard.layout, wall72)
    expect(of(boxes, 'carcass')).toHaveLength(5) // two bases, three uppers; nothing for the knee space
    expect(of(boxes, 'counter')).toHaveLength(1)
  })

  it('gives a 3-drawer base three fronts and three pulls', () => {
    const boxes = one({ sku: 'MV-DB24-3', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' })
    expect(of(boxes, 'front')).toHaveLength(3)
    expect(of(boxes, 'pull')).toHaveLength(3)
  })

  it('stands every pull proud of its own cabinet’s fronts', () => {
    for (const item of [
      { sku: 'MV-DB24-3', x: 0, y: 0, width: 24, height: 34.5, depth: 24, zone: 'Base' as const },
      { sku: 'MV-W2430', x: 0, y: 54, width: 24, height: 30, depth: 12, zone: 'Wall' as const },
    ]) {
      const boxes = one(item)
      const frontFace = Math.max(...of(boxes, 'front').map((b) => b.z + b.d))
      expect(frontFace).toBeCloseTo(item.depth, 9)
      for (const pull of of(boxes, 'pull')) expect(pull.z).toBeGreaterThanOrEqual(frontFace - 1e-9)
    }
  })

  it('draws premiere differently from standard', () => {
    const fronts = (layout: LayoutDto) => of(buildScene(layout, wall72), 'front').length
    expect(fronts(vignette.premiere.layout)).not.toBe(fronts(vignette.standard.layout))
  })

  it('ghosts every obstruction', () => {
    const wall: WallDto = {
      length: 240,
      ceiling: 96,
      obstructions: [
        { type: 'ElectricalPanel', startX: 171, width: 16, height: 30, bottomY: 48 },
        { type: 'WaterHeater', startX: 0, width: 30, height: 72, bottomY: 0 },
      ],
    }
    expect(of(buildScene(panel, wall), 'ghost')).toHaveLength(2)
  })

  it('keeps every cabinet part on the floor, inside the wall and under the ceiling', () => {
    const wall: WallDto = { length: 240, ceiling: 96 }
    for (const b of buildScene(panel, wall).filter((b) => !['wall', 'floor', 'ghost'].includes(b.material))) {
      expect(b.x).toBeGreaterThanOrEqual(-1e-9)
      expect(b.x + b.w).toBeLessThanOrEqual(wall.length + 1e-9)
      expect(b.y).toBeGreaterThanOrEqual(-1e-9)
      expect(b.y + b.h).toBeLessThanOrEqual(wall.ceiling + 1e-9)
      expect(b.z).toBeGreaterThanOrEqual(-1e-9)
    }
  })

  it('draws the wall behind and the floor below everything', () => {
    const boxes = buildScene(panel, { length: 240, ceiling: 96 })
    expect(of(boxes, 'wall')[0].z + of(boxes, 'wall')[0].d).toBeLessThanOrEqual(0)
    expect(of(boxes, 'floor')[0].y + of(boxes, 'floor')[0].h).toBeLessThanOrEqual(0)
  })
})

describe('frameCamera', () => {
  /** Does the wall's every corner land inside the picture for a straight-on camera? */
  function fits(wall: WallDto, fov: number, aspect: number) {
    const frame = frameCamera(wall, fov, aspect)
    const halfV = Math.tan((fov * Math.PI) / 360)
    const halfH = halfV * aspect
    for (const [x, y] of [[0, 0], [wall.length, 0], [0, wall.ceiling], [wall.length, wall.ceiling]]) {
      const depth = frame.position[2] - 0 // the wall face is at z = 0
      expect(Math.abs(x - frame.position[0]) / (depth * halfH)).toBeLessThanOrEqual(1)
      expect(Math.abs(y - frame.position[1]) / (depth * halfV)).toBeLessThanOrEqual(1)
    }
  }

  it('fits a long, low wall and a short, tall wall, on a laptop and a phone', () => {
    for (const wall of [{ length: 360, ceiling: 84 }, { length: 72, ceiling: 120 }]) {
      for (const aspect of [16 / 9, 390 / 242]) fits(wall, 35, aspect)
    }
  })

  it('keeps the same distance when it swings round to an angle', () => {
    const straight = frameCamera(wall72, 35, 1.6)
    const angled = frameCamera(wall72, 35, 1.6, { azimuthDeg: -25, elevationDeg: 12 })
    const dist = (f: typeof straight) => Math.hypot(...f.position.map((p, i) => p - f.target[i]))
    expect(dist(angled)).toBeCloseTo(dist(straight), 6)
    expect(angled.position[0]).toBeLessThan(straight.position[0])
  })
})
