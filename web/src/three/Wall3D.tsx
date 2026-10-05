// web/src/three/Wall3D.tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LayoutDto, WallDto } from '../api/types'
import { buildScene, frameCamera, type MaterialKey } from './buildScene'

/*
  The only file in the app that touches Three.js. Everything it draws comes from buildScene(), which
  is plain data and unit-tested; this file just turns boxes into meshes, points a camera at them and
  cleans up after itself. It renders when something changes, never in a loop.
*/

const FOV = 35
const OPENING_ANGLE = { azimuthDeg: -22, elevationDeg: 10 }

const MATERIALS: Record<MaterialKey, THREE.MeshStandardMaterialParameters> = {
  carcass: { color: 0x9aa0a6, roughness: 0.85 },
  front: { color: 0xb9bdc0, roughness: 0.6 },
  pull: { color: 0x15171a, roughness: 0.4, metalness: 0.2 },
  counter: { color: 0xb5793a, roughness: 0.7 },
  wall: { color: 0xf4f4f2, roughness: 1 },
  floor: { color: 0xdcdbd6, roughness: 1 },
  ghost: { color: 0x9aa3ad, roughness: 1, transparent: true, opacity: 0.22, depthWrite: false },
}

export default function Wall3D({ layout, wall }: { layout: LayoutDto; wall: WallDto }) {
  const host = useRef<HTMLDivElement>(null)
  const frontView = useRef<() => void>(() => undefined)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdcdbd6, 1.8))
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(wall.length * 0.3, wall.ceiling * 1.8, 220)
    scene.add(key)

    // One unit cube, scaled per box: a single geometry however big the wall is.
    const unit = new THREE.BoxGeometry(1, 1, 1)
    const materials = Object.fromEntries(
      Object.entries(MATERIALS).map(([name, params]) => [name, new THREE.MeshStandardMaterial(params)]),
    ) as Record<MaterialKey, THREE.MeshStandardMaterial>

    for (const box of buildScene(layout, wall)) {
      const mesh = new THREE.Mesh(unit, materials[box.material])
      mesh.scale.set(box.w, box.h, box.d)
      mesh.position.set(box.x + box.w / 2, box.y + box.h / 2, box.z + box.d / 2)
      scene.add(mesh)
    }

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minAzimuthAngle = -Math.PI / 3 // never round the back of the wall
    controls.maxAzimuthAngle = Math.PI / 3
    controls.minPolarAngle = Math.PI / 4
    controls.maxPolarAngle = Math.PI / 2 - 0.02 // never under the floor

    const render = () => {
      renderer.render(scene, camera)
      el.dataset.geometries = String(renderer.info.memory.geometries)
      el.dataset.textures = String(renderer.info.memory.textures)
    }

    const resize = () => {
      const width = el.clientWidth || 600
      const height = Math.round(width * 0.62)
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
      observer.disconnect()
      controls.removeEventListener('change', render)
      controls.dispose()
      unit.dispose()
      Object.values(materials).forEach((material) => material.dispose())
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
