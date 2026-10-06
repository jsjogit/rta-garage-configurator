// web/src/three/Wall3D.tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { LayoutDto, WallDto } from '../api/types'
import { buildScene, frameCamera, type Box, type MaterialKey } from './buildScene'
import { assetUrl } from '../preview/assets'

/*
  The only file in the app that touches Three.js. Everything it draws comes from buildScene(), which
  is plain data and unit-tested; this file turns those parts into instanced meshes, lights them the
  way the manufacturer's renders are lit, points a camera at them and cleans up after itself. It
  renders when something changes, never in a loop.
*/

const FOV = 35
const OPENING_ANGLE = { azimuthDeg: -22, elevationDeg: 10 }
const EDGE_RADIUS = 0.0625 // 1/16": enough for edges to catch the light as in the renders

const MATERIALS: Record<MaterialKey, THREE.MeshStandardMaterialParameters> = {
  // Sampled from the manufacturer's renders (2026-10-06).
  carcass: { color: 0x6f7273, roughness: 0.75 },
  front: { color: 0x787a7b, roughness: 0.65 },
  pull: { color: 0x1a1c1e, roughness: 0.45, metalness: 0.3 },
  counter: { color: 0xf7c79c, roughness: 0.6 }, // warms the butcher-block texture to the renders' amber
  leg: { color: 0xd4d7d9, roughness: 0.25, metalness: 0.9 },
  wall: { color: 0xf4f4f2, roughness: 1 },
  floor: { color: 0xdcdbd6, roughness: 1 },
  ghost: { color: 0x9aa3ad, roughness: 1, transparent: true, opacity: 0.22, depthWrite: false },
}

/** A faint, fixed noise, used as a bump map so the laminate reads as a surface rather than paint. */
function laminateGrain(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  let seed = 7
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 16807) % 2147483647
    const v = 120 + (seed % 16)
    image.data.set([v, v, v, 255], i * 4)
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 6)
  return texture
}

export default function Wall3D({ layout, wall }: { layout: LayoutDto; wall: WallDto }) {
  const host = useRef<HTMLDivElement>(null)
  const frontView = useRef<() => void>(() => undefined)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap // PCFSoftShadowMap is gone in this release; radius softens
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.85
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    // Image-based ambient light from Three.js's built-in studio room (no HDR file), plus one soft key.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    // Tuned side by side with the renders: brighter washes the gray out to silver and the wood to yellow.
    scene.environmentIntensity = 0.45
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(wall.length * 0.35, wall.ceiling * 1.6, 160)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.radius = 6
    const reach = Math.max(wall.length, wall.ceiling)
    Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 800 })
    key.target.position.set(wall.length / 2, 0, 0)
    scene.add(key, key.target)
    // A soft fill from the other side, so shaded cabinet sides stay gray as in the renders, not black.
    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    fill.position.set(-wall.length * 0.5, wall.ceiling, 120)
    scene.add(fill)

    const materials = Object.fromEntries(
      Object.entries(MATERIALS).map(([name, params]) => [name, new THREE.MeshStandardMaterial(params)]),
    ) as Record<MaterialKey, THREE.MeshStandardMaterial>

    const grain = laminateGrain()
    for (const m of [materials.carcass, materials.front]) {
      m.bumpMap = grain
      m.bumpScale = 0.15
    }

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000)
    // Set first thing in cleanup: the wood texture can finish loading after the view has closed, and
    // must not draw on a renderer that has already been torn down.
    let disposed = false
    const render = () => {
      if (disposed) return
      renderer.render(scene, camera)
      el.dataset.geometries = String(renderer.info.memory.geometries)
      el.dataset.textures = String(renderer.info.memory.textures)
    }

    // Butcher block cut from the manufacturer's countertop render (web/scripts/build-renders.mjs).
    const wood = new THREE.TextureLoader().load(assetUrl('textures/butcher-block.webp'), render)
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping
    wood.colorSpace = THREE.SRGBColorSpace
    wood.repeat.set(4, 1)
    materials.counter.map = wood

    // Plain boxes and cylinders scale one unit shape per instance; rounded boxes need a geometry per
    // size because their edge radius must not stretch. One InstancedMesh per group.
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 20)
    const rounded = new Map<string, THREE.BufferGeometry>()
    const roundedFor = (b: Box) => {
      const size = `${b.w}|${b.h}|${b.d}`
      if (!rounded.has(size)) {
        rounded.set(size, new RoundedBoxGeometry(b.w, b.h, b.d, 2, Math.min(EDGE_RADIUS, b.w / 4, b.h / 4, b.d / 4)))
      }
      return rounded.get(size)!
    }

    const groups = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; boxes: Box[]; scaled: boolean }>()
    for (const b of buildScene(layout, wall)) {
      const shape = b.shape ?? 'box'
      const geometry = shape === 'rounded' ? roundedFor(b) : shape === 'cylinder' ? unitCylinder : unitBox
      const group = `${shape}|${b.material}|${shape === 'rounded' ? `${b.w}|${b.h}|${b.d}` : ''}`
      if (!groups.has(group)) groups.set(group, { geometry, material: materials[b.material], boxes: [], scaled: shape !== 'rounded' })
      groups.get(group)!.boxes.push(b)
    }

    const unscaled = new THREE.Vector3(1, 1, 1)
    const turn = new THREE.Quaternion()
    const matrix = new THREE.Matrix4()
    const meshes: THREE.InstancedMesh[] = []
    for (const { geometry, material, boxes, scaled } of groups.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, boxes.length)
      boxes.forEach((b, i) => {
        matrix.compose(
          new THREE.Vector3(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2),
          turn,
          scaled ? new THREE.Vector3(b.w, b.h, b.d) : unscaled,
        )
        mesh.setMatrixAt(i, matrix)
      })
      const backdrop = material === materials.wall || material === materials.floor || material === materials.ghost
      mesh.castShadow = !backdrop
      mesh.receiveShadow = material !== materials.ghost
      meshes.push(mesh)
      scene.add(mesh)
    }

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minAzimuthAngle = -Math.PI / 4 // never round the back of the wall, nor so far a long wall leaves the frame
    controls.maxAzimuthAngle = Math.PI / 4
    controls.minPolarAngle = Math.PI / 4
    controls.maxPolarAngle = Math.PI / 2 - 0.02 // never under the floor

    const resize = () => {
      const width = el.clientWidth || 600
      const height = el.clientHeight > 0 ? el.clientHeight : Math.round(width * 0.62)
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const place = (angle: { azimuthDeg?: number; elevationDeg?: number }) => {
      const frame = frameCamera(wall, FOV, camera.aspect, angle)
      camera.position.set(...frame.position)
      controls.target.set(...frame.target)
      controls.minDistance = frame.distance * 0.35
      controls.maxDistance = frame.distance * 1.6
      controls.update()
      render()
    }

    frontView.current = () => place({})
    resize()
    place(OPENING_ANGLE)
    controls.addEventListener('change', render)

    const observer = new ResizeObserver(() => {
      resize()
      render()
    })
    observer.observe(el)

    return () => {
      disposed = true
      observer.disconnect()
      controls.removeEventListener('change', render)
      controls.dispose()
      meshes.forEach((mesh) => mesh.dispose())
      unitBox.dispose()
      unitCylinder.dispose()
      rounded.forEach((geometry) => geometry.dispose())
      Object.values(materials).forEach((material) => material.dispose())
      grain.dispose()
      wood.dispose()
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      // Browsers cap live WebGL contexts (~16); give this one back now rather than at GC.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [layout, wall])

  return (
    <div className="wall3d">
      <div ref={host} className="wall3d-canvas" />
      <button type="button" className="btn ghost wall3d-front" onClick={() => frontView.current()}>
        Front view
      </button>
    </div>
  )
}
