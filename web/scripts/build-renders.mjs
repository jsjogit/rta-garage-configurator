// web/scripts/build-renders.mjs
// Derives web-size product images and the butcher-block texture from the manufacturer's renders.
// The originals live in assets/reference/sku-renders (not in git); rerun after they change.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = new URL('../../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('data/render-manifest.json', root), 'utf8'))
// fileURLToPath, not .pathname: the render filenames contain spaces.
const source = (file) => fileURLToPath(new URL(`assets/reference/sku-renders/${file}`, root))
const out = (path) => fileURLToPath(new URL(`web/public/${path}`, root))

mkdirSync(out('renders'), { recursive: true })
mkdirSync(out('textures'), { recursive: true })

for (const [sku, file] of Object.entries(manifest.renders)) {
  // Trim the white studio border so every thumbnail fills its box the same way.
  const trimmed = await sharp(source(file)).trim({ background: '#ffffff', threshold: 12 }).toBuffer()
  for (const size of [96, 320]) {
    await sharp(trimmed)
      .resize(size, size, { fit: 'contain', background: '#ffffff' })
      .webp({ quality: 82 })
      .toFile(out(`renders/${sku}-${size}.webp`))
  }
  console.log(`renders/${sku}`)
}

// The countertop render is a 3/4 view whose long edge runs down-right at the measured grain angle.
// sharp rotates clockwise for positive angles, so rotate by the negative to lay the strips level,
// trim to the slab, then cut a band from the middle of its top surface, clear of the front edge.
const tex = manifest.texture.butcherBlock
const levelled = await sharp(source(tex.from)).rotate(-tex.grainAngleDegrees, { background: '#ffffff' }).toBuffer()
const slab = await sharp(levelled).trim({ background: '#ffffff', threshold: 12 }).toBuffer({ resolveWithObject: true })
const { width, height } = slab.info
await sharp(slab.data)
  .extract({ left: Math.round(width * 0.3), top: Math.round(height * 0.05), width: Math.round(width * 0.4), height: Math.round(height * 0.7) })
  .resize(512, 128, { fit: 'fill' })
  .webp({ quality: 82 })
  .toFile(out('textures/butcher-block.webp'))
console.log('textures/butcher-block')

writeFileSync(new URL('web/src/renders/available.json', root), JSON.stringify(Object.keys(manifest.renders).sort(), null, 2) + '\n')
console.log('src/renders/available.json')
