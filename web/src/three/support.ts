// web/src/three/support.ts
/** Whether this browser can draw the 3D view. Never throws, and never imports Three.js. */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
